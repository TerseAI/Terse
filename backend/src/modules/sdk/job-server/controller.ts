import { Request, Response } from "express"
import { SdkJobServerCheckResponse, agentIdParamsSchema } from "terse-types/types"

import { extractErrorMessage } from "../../../common/strings"
import { db } from "../../../loaders/prisma"
import { runWebhookJobHandshakeChallenge } from "../../../services/webhookJobHandshakeChallenge"

export async function handleVerifySdkJobServer(req: Request, res: Response) {
    const { agentId } = agentIdParamsSchema.parse(req.params)
    const session = req.session

    if (!session?.user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const agent = await db().automations.findFirst({
            where: { id: agentId, organization_id: session.user.organizationId },
            select: { project: { select: { remote_server_url: true, signing_secret: true } } }
        })

        if (!agent) return res.status(404).json({ error: "Agent not found" })

        if (!agent.project?.remote_server_url) {
            const response: SdkJobServerCheckResponse = {
                success: false,
                message: "This SDK job does not have a self-hosted server URL configured."
            }
            return res.status(400).json(response)
        }

        if (!agent.project?.signing_secret) {
            const response: SdkJobServerCheckResponse = {
                success: false,
                message: "This SDK job does not have a signing secret configured. Try redeploying."
            }
            return res.status(400).json(response)
        }

        const result = await runWebhookJobHandshakeChallenge({
            remoteServerUrl: agent.project.remote_server_url,
            signingSecret: agent.project.signing_secret
        })

        if (result.ok) {
            const response: SdkJobServerCheckResponse = {
                success: true,
                message: "Server verified. Terse successfully completed the challenge handshake with your trigger endpoint.",
                triggerUrl: result.triggerUrl
            }
            return res.status(200).json(response)
        }

        const response: SdkJobServerCheckResponse = {
            success: false,
            message: result.message,
            triggerUrl: result.triggerUrl,
            step: result.step,
            httpStatus: result.httpStatus
        }
        return res.status(200).json(response)
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: extractErrorMessage(error)
        } satisfies SdkJobServerCheckResponse)
    }
}

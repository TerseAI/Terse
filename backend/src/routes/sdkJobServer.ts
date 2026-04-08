import { Request, Response } from "express"
import { SdkJobServerCheckResponse, agentIdParamsSchema } from "terse-types/types"

import { db } from "../prismaClient"
import { runWebhookJobHandshakeChallenge } from "../services/webhookJobHandshakeChallenge"
import { extractErrorMessage } from "../utility/strings"

export async function handleVerifySdkJobServer(req: Request, res: Response) {
    const { agentId } = agentIdParamsSchema.parse(req.params)
    const session = req.session

    if (!session?.user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const agent = await db().automations.findFirst({
            where: {
                id: agentId,
                organization_id: session.user.organizationId
            },
            select: {
                source: true,
                prompt: {
                    select: {
                        job_url: true
                    }
                }
            }
        })

        if (!agent) {
            return res.status(404).json({ error: "Agent not found" })
        }

        if (agent.source !== "SDK" || !agent.prompt?.job_url) {
            const response: SdkJobServerCheckResponse = {
                success: false,
                message: "This SDK job does not have a self-hosted server URL configured."
            }
            return res.status(400).json(response)
        }

        const result = await runWebhookJobHandshakeChallenge({
            jobUrl: agent.prompt.job_url,
            organizationId: session.user.organizationId
        })

        if (result.ok) {
            const response: SdkJobServerCheckResponse = {
                success: true,
                message: "Server verified. Terse successfully reached your trigger endpoint and validated the returned API key.",
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

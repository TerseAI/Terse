import { InputConfigType } from "@prisma/client"
import crypto from "crypto"
import { Request, Response } from "express"
import { attioWebhookPayloadSchema } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"
import type { AttioAttribute, AttioObject, AttioObjectWithAttributes } from "terse-types/types"
import { z } from "zod"

import logger from "../../../common/logger"
import { AttioIntegrationManager } from "../../../integrations/AttioIntegration"
import { db } from "../../../loaders/prisma"
import { SecretService } from "../../../services/SecretService"

const webhookParamsSchema = z.object({ triggerId: z.string() })

export async function getAttioIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new AttioIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching Attio integrations:", { error })
        res.status(500).json({ error: "Failed to fetch Attio integrations" })
    }
}

export async function getAttioObjects(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const { integrationId } = req.params
    if (!integrationId) {
        res.status(400).json({ error: "Missing integrationId parameter" })
        return
    }

    try {
        const manager = new AttioIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            res.status(404).json({ error: "Attio integration not found or not connected" })
            return
        }

        const response = await fetch("https://api.attio.com/v2/objects", {
            headers: { Authorization: `Bearer ${accessToken}` }
        })

        if (!response.ok) {
            const errorText = await response.text()
            logger.error("Failed to fetch Attio objects", { status: response.status, error: errorText })
            res.status(response.status).json({ error: "Failed to fetch Attio objects" })
            return
        }

        const data = (await response.json()) as { data?: AttioObject[] }
        const objects = data?.data || []

        const objectsWithAttributes = await Promise.all(
            objects.map(async (obj): Promise<AttioObjectWithAttributes> => {
                const attrResponse = await fetch(`https://api.attio.com/v2/objects/${encodeURIComponent(obj.api_slug)}/attributes`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                })
                const attributes = attrResponse.ok ? ((await attrResponse.json()) as { data?: AttioAttribute[] })?.data || [] : []
                return { ...obj, attributes }
            })
        )

        res.status(200).json(objectsWithAttributes)
    } catch (error) {
        logger.error("Error fetching Attio objects:", { error })
        res.status(500).json({ error: "Failed to fetch Attio objects" })
    }
}

export const attioOAuthCallback = async (req: Request, res: Response) => {
    const integration = new AttioIntegrationManager()
    await integration.processInstallationCallback(req, res)
}

export async function handleAttioWebhook(req: Request, res: Response) {
    const { triggerId } = webhookParamsSchema.parse(req.params)

    try {
        const rawBody = req.body as Buffer
        if (!Buffer.isBuffer(rawBody)) {
            logger.error("Attio webhook: missing raw body", { triggerId })
            res.status(400).json({ error: "Missing raw body" })
            return
        }

        const trigger = await db().automation_inputs.findFirst({
            where: { id: triggerId, config_type: InputConfigType.ATTIO_INPUT }
        })
        if (!trigger) {
            logger.warn("Attio webhook: unknown trigger", { triggerId })
            res.status(404).json({ error: "Trigger not found" })
            return
        }
        const secretService = SecretService.getInstance()
        const secret = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.ATTIO, recordId: triggerId } })
        if (!secret.webhookSecret) {
            logger.error("Attio webhook: signing secret not found", { triggerId })
            res.status(500).json({ error: "Webhook secret missing" })
            return
        }

        const headerSignature = req.get("attio-signature") ?? req.get("x-attio-signature")
        if (!verifyAttioSignature(headerSignature, rawBody, secret.webhookSecret)) {
            logger.error("Attio webhook: invalid signature", { triggerId })
            res.status(401).json({ error: "Invalid signature" })
            return
        }

        let body: unknown
        try {
            body = JSON.parse(rawBody.toString("utf8"))
        } catch (error) {
            logger.warn("Attio webhook: invalid JSON", { triggerId, error })
            res.status(400).json({ error: "Invalid JSON" })
            return
        }

        const parsed = attioWebhookPayloadSchema.safeParse(body)
        if (!parsed.success) {
            logger.warn("Attio webhook: payload validation failed", { triggerId, issues: parsed.error.issues })
            res.status(400).json({ error: "Invalid payload" })
            return
        }

        const idempotencyKey = req.get("idempotency-key") ?? crypto.randomUUID()

        res.status(200).json({ received: true })

        const manager = new AttioIntegrationManager()
        manager.processWebhookEvent({ triggerId, payload: parsed.data, idempotencyKey }).catch(error => {
            logger.error("Error processing Attio webhook", { error, triggerId })
        })
    } catch (error) {
        logger.error("Attio webhook handler failed", { error, triggerId })
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to process webhook" })
        }
    }
}

function verifyAttioSignature(headerSignature: string | undefined, rawBody: Buffer, secret: string): boolean {
    if (typeof headerSignature !== "string") return false
    try {
        const expected = Buffer.from(headerSignature, "hex")
        const computed = crypto.createHmac("sha256", secret).update(rawBody).digest()
        return expected.length === computed.length && crypto.timingSafeEqual(computed, expected)
    } catch (error) {
        logger.error("Error verifying Attio signature", { error })
        return false
    }
}

import { Request, Response } from "express"

import { WorkOSIntegrationManager } from "../integrations/WorkOSIntegration"
import { parseFormSubmissionFromRequest } from "../integrations/abstract/Integration"
import { emitIntegrationFormCompletedTaskIfNeeded } from "../integrations/helpers/emitIntegrationFormCompletedTask"
import logger from "../logger"
import { db } from "../prismaClient"
import { IntegrationType } from "../shared/Integrations"
import { workos } from "../utility/workos"

export async function getWorkOSIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new WorkOSIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching WorkOS integrations:", { error })
        res.status(500).json({ error: "Failed to fetch WorkOS integrations" })
    }
}

export async function createOrUpdateWorkOSIntegration(req: Request, res: Response) {
    const input = parseFormSubmissionFromRequest(req)
    if (!input) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new WorkOSIntegrationManager()
        const result = await manager.processFormSubmission(input)

        if (!result.success) {
            res.status(result.statusCode || 500).json({
                error: result.error || "Failed to process integration",
                ...(result.data || {})
            })
            return
        }

        res.status(result.statusCode || 200).json(result.data || { success: true })
    } catch (error) {
        logger.error("Error creating/updating WorkOS integration:", { error })
        res.status(500).json({ error: "Failed to process integration" })
    }
}

export async function updateWorkOSWebhookSecret(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const { webhookSecret, state: stateToken } = req.body
    if (!webhookSecret || typeof webhookSecret !== "string") {
        res.status(400).json({ error: "Webhook secret is required" })
        return
    }

    try {
        const integration = await db().workos_integrations.findFirst({
            where: { organization_id: req.session.user.organizationId }
        })

        if (!integration) {
            res.status(404).json({ error: "No WorkOS integration found" })
            return
        }

        await db().workos_integrations.update({
            where: { id: integration.id },
            data: { webhook_secret: webhookSecret }
        })

        logger.info("Updated WorkOS webhook secret", { integrationId: integration.id })

        const manager = new WorkOSIntegrationManager()
        await emitIntegrationFormCompletedTaskIfNeeded(stateToken as string | undefined, manager, req.session.user.id, req.session.user.organizationId, IntegrationType.WORKOS)

        res.status(200).json({ success: true })
    } catch (error) {
        logger.error("Error updating WorkOS webhook secret:", { error })
        res.status(500).json({ error: "Failed to update webhook secret" })
    }
}

export async function handleWorkOSTriggerWebhook(req: Request, res: Response) {
    const { integrationId } = req.params

    if (!integrationId) {
        res.status(400).json({ error: "Missing integrationId" })
        return
    }

    try {
        // Look up the integration
        const integration = await db().workos_integrations.findUnique({
            where: { id: integrationId }
        })

        if (!integration) {
            logger.warn("WorkOS trigger webhook received for unknown integration", { integrationId })
            res.status(404).json({ error: "Integration not found" })
            return
        }

        // express.raw() gives us a Buffer
        const rawBody = req.body as Buffer
        if (!rawBody || !Buffer.isBuffer(rawBody)) {
            logger.warn("WorkOS trigger webhook: missing or invalid raw body", { integrationId })
            res.status(400).json({ error: "Bad request" })
            return
        }

        const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>
        const sigHeader = req.get("workos-signature") ?? req.get("WorkOS-Signature") ?? ""

        // Verify webhook signature using the WorkOS SDK
        if (integration.webhook_secret) {
            if (!sigHeader) {
                logger.warn("WorkOS trigger webhook missing signature header", { integrationId })
                res.status(401).json({ error: "Missing signature" })
                return
            }
            await workos.webhooks.constructEvent({
                payload,
                sigHeader,
                secret: integration.webhook_secret
            })
        } else {
            logger.warn("WorkOS trigger webhook received without signing secret configured — skipping signature verification", { integrationId })
        }

        // Respond 200 immediately
        res.status(200).json({ received: true })

        // Process asynchronously
        const manager = new WorkOSIntegrationManager()
        manager.processWebhookEvent({ integrationId, payload: payload as any }).catch(error => {
            logger.error("Error processing WorkOS trigger webhook", { error, integrationId })
        })
    } catch (error) {
        logger.error("WorkOS trigger webhook verification failed", { error, integrationId })
        if (!res.headersSent) {
            res.status(401).json({ error: "Invalid signature" })
        }
    }
}

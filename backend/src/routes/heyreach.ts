import { Request, Response } from "express"
import { heyReachWebhookPayloadSchema } from "terse-types"
import { z } from "zod"

import { HeyReachIntegrationManager, fetchHeyReachCampaigns } from "../integrations/HeyReachIntegration"
import { parseFormSubmissionFromRequest } from "../integrations/abstract/Integration"
import logger from "../logger"
import { db } from "../prismaClient"

const webhookParamsSchema = z.object({ triggerId: z.string() })

export async function getHeyReachIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new HeyReachIntegrationManager()
        const integrations = await manager.getInstancesForOrganization(req.session.user.organizationId)
        res.status(200).json(integrations)
    } catch (error) {
        logger.error("Error fetching HeyReach integrations:", { error })
        res.status(500).json({ error: "Failed to fetch HeyReach integrations" })
    }
}

export async function createOrUpdateHeyReachIntegration(req: Request, res: Response) {
    const input = parseFormSubmissionFromRequest(req)
    if (!input) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    try {
        const manager = new HeyReachIntegrationManager()
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
        logger.error("Error creating/updating HeyReach integration:", { error })
        res.status(500).json({ error: "Failed to process integration" })
    }
}

const campaignsQuerySchema = z.object({ integrationId: z.string() })

export async function getHeyReachCampaigns(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const parsed = campaignsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
        res.status(400).json({ error: "integrationId is required" })
        return
    }

    try {
        const campaigns = await fetchHeyReachCampaigns(req.session.user.organizationId, parsed.data.integrationId)
        res.status(200).json({ campaigns })
    } catch (error: any) {
        logger.error("Error fetching HeyReach campaigns:", { error })
        res.status(500).json({ error: "Failed to fetch campaigns", details: error?.message })
    }
}

export async function handleHeyReachWebhook(req: Request, res: Response) {
    const { triggerId } = webhookParamsSchema.parse(req.params)

    try {
        const trigger = await db().automation_inputs.findUnique({ where: { id: triggerId } })
        if (!trigger) {
            logger.warn("HeyReach webhook received for unknown trigger", { triggerId })
            res.status(404).json({ error: "Trigger not found" })
            return
        }

        const integrationId = trigger.integration_id
        logger.info("HeyReach webhook received: triggerId", { triggerId })

        const parsed = heyReachWebhookPayloadSchema.safeParse(req.body)
        if (!parsed.success) {
            logger.warn("HeyReach webhook payload failed validation", { integrationId, issues: parsed.error.issues })
            res.status(400).json({ error: "Invalid payload" })
            return
        }
        const payload = parsed.data

        res.status(200).json({ received: true })

        const manager = new HeyReachIntegrationManager()
        manager.processWebhookEvent({ triggerId, payload }).catch(error => {
            logger.error("Error processing HeyReach webhook", { error, triggerId })
        })
    } catch (error) {
        logger.error("HeyReach webhook handler failed", { error, triggerId })
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to process webhook" })
        }
    }
}

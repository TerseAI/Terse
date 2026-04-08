import { Request, Response } from "express"
import type { TriggerEvent } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { manualTriggerParamsSchema, manualTriggerRequestSchema, triggerWithEventParamsSchema, triggerWithEventRequestSchema } from "terse-types/types"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { cloudScheduler } from "../config/settings"
import { CronJobIntegrationManager } from "../integrations/CronJobIntegration"
import { TriggerEventRuntime } from "../integrations/abstract/TriggerEventRuntime"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { getUserForOrg } from "../utility/workos"

export interface ManualTriggerRequest {
    context?: string
}

class SyntheticTriggerEventRuntime extends TriggerEventRuntime {
    readonly integrationType: IntegrationType
    readonly eventType: string
    readonly data: TriggerEvent

    constructor(event: TriggerEvent) {
        super()
        this.data = event
        this.integrationType = event.integrationType
        this.eventType = event.eventType
    }

    matchesAgentTrigger(_agentTrigger: AgentTriggerWithConfigs): boolean {
        return true
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: "manual_sample",
            integration: this.integrationType,
            source: "Manual trigger with sample event",
            title: this.debugLog()
        }
    }
}

export async function handleManualTrigger(req: Request, res: Response) {
    const { inputId } = manualTriggerParamsSchema.parse(req.params)
    const { context } = manualTriggerRequestSchema.parse(req.body)
    const session = req.session
    if (!session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    logger.info("🖱️ Manual trigger received", { inputId, userId: session.user.id, hasContext: !!context })

    // Acknowledge immediately
    res.status(200).json({ received: true, message: "Manual trigger initiated" })

    // Process asynchronously
    const cronJobManager = new CronJobIntegrationManager()
    cronJobManager
        .processWebhookEvent({
            inputId,
            isManualTrigger: true,
            manualContext: context
        })
        .catch(error => {
            logger.error("❌ Error processing manual trigger", { error, inputId })
        })
}

export async function handleScheduleWebhook(req: Request, res: Response) {
    const { inputId } = req.params

    logger.info("⏰ Schedule webhook received", { inputId })

    // Verify the request is from Cloud Scheduler using a shared secret
    const authHeader = req.headers["authorization"]

    if (!authHeader) {
        logger.warn("⚠️  Unauthorized schedule webhook request: Missing Authorization header", { inputId })
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    // Extract token from "Bearer <token>" or just check the header value
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader

    // Validate against configured secret
    if (token !== cloudScheduler.secret) {
        logger.warn("⚠️  Unauthorized schedule webhook request: Invalid token", { inputId })
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    if (!inputId) {
        logger.warn("⚠️  Schedule webhook missing inputId")
        res.status(400).json({ error: "Missing inputId" })
        return
    }

    // Acknowledge immediately
    res.status(200).json({ received: true })

    // Process asynchronously
    const cronJobManager = new CronJobIntegrationManager()
    cronJobManager.processWebhookEvent({ inputId }).catch(error => {
        logger.error("❌ Error processing schedule webhook", { error, inputId })
    })
}

export async function handleTriggerWithEvent(req: Request, res: Response) {
    const { automationId } = triggerWithEventParamsSchema.parse(req.params)
    const session = req.session
    if (!session?.user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const { event } = triggerWithEventRequestSchema.parse(req.body)

    const prisma = db()
    const automation = await prisma.automations.findFirst({
        where: { id: automationId, organization_id: session.user.organizationId }
    })

    if (!automation) {
        return res.status(404).json({ error: "Automation not found" })
    }

    const user = await getUserForOrg(session.user.id, session.user.organizationId)
    if (!user) {
        return res.status(404).json({ error: "User not found" })
    }

    res.status(200).json({ received: true, message: "Trigger with event initiated" })

    runWithUserContext(user, async () => {
        const syntheticEvent = new SyntheticTriggerEventRuntime(event)
        const eventProcessor = new EventProcessor(syntheticEvent, user, { isManuallyTriggered: true })
        await eventProcessor.processSingleAgent(automationId)
    }).catch(error => {
        logger.error("Error processing trigger with event", { error, automationId })
    })
}

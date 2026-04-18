import { Request, Response } from "express"
import type { SerializedEvent, Trigger, TriggerWithEventRequest } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { manualTriggerParamsSchema, manualTriggerRequestSchema, triggerWithEventParamsSchema, triggerWithEventRequestSchema } from "terse-types/types"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { cloudScheduler } from "../config/settings"
import { CronJobIntegrationManager } from "../integrations/CronJobIntegration"
import { buildGithubTriggerMetadata } from "../integrations/GithubIntegration"
import { TriggerRuntime } from "../integrations/abstract/TriggerRuntime"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { extractErrorMessage } from "../utility/strings"
import { getUserForOrg } from "../utility/workos"

import { fetchEventFromRunId } from "./sdkRunTriggerEvent"

export interface ManualTriggerRequest {
    context?: string
}

class SyntheticTriggerRuntime extends TriggerRuntime<Trigger> {
    readonly integrationType: Trigger["integrationType"]
    readonly data: Trigger

    constructor(event: Trigger) {
        super()
        this.data = event
        this.integrationType = event.integrationType
    }

    matchesAgentTrigger(_agentTrigger: AgentTriggerWithConfigs): boolean {
        return true
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // TODO: Make this a method on the TriggerRuntime class and use it for all integrations
        // Delegate to the same metadata builders that real webhook-delivered runtimes use,
        // so sample-event runs show rich titles (e.g. "#482 Fix something") instead of the
        // bare `debugLog()` string. Fall back to a generic manual-sample shape for
        // integrations we haven't extracted yet.
        if (this.data.eventType !== "manual_sample" && this.data.integrationType === IntegrationType.GITHUB) {
            return buildGithubTriggerMetadata(this.data)
        }

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

    const organizationId = session.user.organizationId

    const triggerWithEventRequest = triggerWithEventRequestSchema.parse(req.body)
    let event: Trigger | null
    try {
        event = await resolveEvent(triggerWithEventRequest, organizationId)
    } catch (error) {
        logger.error("Failed to resolve trigger event", {
            automationId,
            organizationId,
            error: extractErrorMessage(error)
        })
        return res.status(500).json({ error: "Failed to resolve trigger event" })
    }
    if (!event) {
        return res.status(404).json({ error: "Event not found" })
    }

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
        const syntheticEvent = new SyntheticTriggerRuntime(event)
        const eventProcessor = new EventProcessor(syntheticEvent, user, { isManuallyTriggered: true })
        await eventProcessor.processSingleAgent(automationId)
    }).catch(error => {
        logger.error("Error processing trigger with event", { error, automationId })
    })
}

async function resolveEvent(triggerWithEventRequest: TriggerWithEventRequest, organizationId: string): Promise<Trigger | null> {
    if (triggerWithEventRequest.event) {
        return triggerWithEventRequest.event
    }

    if (triggerWithEventRequest.runId) {
        const serializedEvent = await fetchEventFromRunId(triggerWithEventRequest.runId, organizationId)
        if (!serializedEvent) {
            return null
        }
        return serializedEvent.event.data
    }

    throw new Error("Invalid trigger with event request")
}

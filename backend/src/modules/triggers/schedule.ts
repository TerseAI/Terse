import { Prisma } from "@prisma/client"
import { Request, Response } from "express"
import { type ParallelMonitorDetectedWebhookPayload, ParallelMonitorDetectedWebhookPayloadSchema, type SerializedEvent, type Trigger, type TriggerWithEventRequest } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { manualTriggerParamsSchema, manualTriggerRequestSchema, triggerWithEventParamsSchema, triggerWithEventRequestSchema } from "terse-types/types"

import logger, { runWithUserContext } from "../../common/logger"
import { verifyParallelWebhookSignature } from "../../common/parallelWebhookSignature"
import { extractErrorMessage } from "../../common/strings"
import { TriggerRuntime } from "../../integrations/abstract/TriggerRuntime"
import { CronJobIntegrationManager } from "../../integrations/cronJob/integration"
import { buildGithubTriggerMetadata } from "../../integrations/github/integration"
import { WebMonitorIntegrationManager } from "../../integrations/webMonitor/integration"
import { resolveUserInOrg } from "../../utility/identity"
import { db } from "../../loaders/prisma"
import { EventProcessor } from "../../modules/agents/AgentRunner/EventProcessor"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { fetchEventFromRunId } from "../sdk/run-trigger/controller"

interface ManualTriggerRequest {
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
        throw new Error("SyntheticTriggerRuntime must not be routed through EventProcessor.process(); use processSingleAgent")
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

    const organizationId = session.user.organizationId

    const ownedInput = await db().automation_inputs.findFirst({
        where: {
            id: inputId,
            automation: { organization_id: organizationId }
        },
        select: { id: true }
    })
    if (!ownedInput) {
        return res.status(404).json({ error: "Schedule trigger not found" })
    }

    logger.info("🖱️ Manual trigger received", { inputId, userId: session.user.id, organizationId, hasContext: !!context })

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

function isPrismaUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export async function handleWebMonitorWebhook(req: Request, res: Response) {
    const { inputId } = req.params
    const rawBody = req.body
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "")

    const webhookId = (req.get("webhook-id") ?? req.headers["webhook-id"]) as string | undefined
    const webhookTimestamp = (req.get("webhook-timestamp") ?? req.headers["webhook-timestamp"]) as string | undefined
    const webhookSignature = (req.get("webhook-signature") ?? req.headers["webhook-signature"]) as string | undefined

    if (!inputId) {
        res.status(400).send("Missing inputId")
        return
    }

    if (!webhookId || !webhookTimestamp) {
        logger.warn("Web event webhook missing id or timestamp headers", { inputId })
        res.status(400).send("Missing webhook headers")
        return
    }

    if (!verifyParallelWebhookSignature(webhookSignature, new WebMonitorIntegrationManager().config.webhookSecret, webhookId, webhookTimestamp, bodyStr)) {
        logger.warn("Web event webhook signature verification failed", { inputId })
        res.status(401).send("Invalid signature")
        return
    }

    let parsedJson: ParallelMonitorDetectedWebhookPayload
    try {
        const rawJson = JSON.parse(bodyStr)
        parsedJson = ParallelMonitorDetectedWebhookPayloadSchema.parse(rawJson)
    } catch {
        res.status(400).send("Invalid JSON")
        return
    }

    try {
        await db().webmonitor_webhook_deliveries.create({
            data: { webhook_id: webhookId }
        })
    } catch (error) {
        if (isPrismaUniqueViolation(error)) {
            res.status(200).send("OK")
            return
        }
        logger.error("Web event webhook dedupe insert failed", { error, inputId })
        res.status(500).send("Server error")
        return
    }

    res.status(200).send("OK")

    const manager = new WebMonitorIntegrationManager()
    manager
        .processWebhookEvent({
            inputId,
            rawBody: bodyStr,
            parsedJson
        })
        .catch(error => {
            logger.error("Error processing web event webhook", { error, inputId })
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

    const user = await resolveUserInOrg(session.user.id, session.user.organizationId)
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

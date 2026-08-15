import { Prisma } from "@prisma/client"
import { Request, Response } from "express"
import { type ParallelMonitorDetectedWebhookPayload, ParallelMonitorDetectedWebhookPayloadSchema, type SerializedEvent, type Trigger, type TriggerWithEventRequest } from "terse-types"
import { manualTriggerParamsSchema, manualTriggerRequestSchema, triggerWithEventParamsSchema, triggerWithEventRequestSchema } from "terse-types/types"

import logger, { runWithUserContext } from "../../common/logger"
import { verifyParallelWebhookSignature } from "../../common/parallelWebhookSignature"
import { extractErrorMessage } from "../../common/strings"
import { WebMonitorIntegrationManager } from "../../integrations/webMonitor/integration"
import { db } from "../../loaders/prisma"
import { EventProcessor } from "../../modules/agents/AgentRunner/EventProcessor"
import { enqueueManualScheduleJob } from "../../tasks/queues/scheduleQueue"
import { resolveUserInOrg } from "../../utility/identity"
import { fetchEventFromRunId } from "../sdk/run-trigger/controller"

import { SyntheticTriggerRuntime } from "./syntheticTriggerRuntime"

interface ManualTriggerRequest {
    context?: string
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

    // Enqueue before the ack: a 200 means the trigger survives a crash of this process.
    await enqueueManualScheduleJob(inputId, context)

    res.status(200).json({ received: true, message: "Manual trigger initiated" })
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

    const prisma = db()
    const automation = await prisma.automations.findFirst({
        where: { id: automationId, organization_id: session.user.organizationId }
    })

    if (!automation) {
        return res.status(404).json({ error: "Automation not found" })
    }

    let event: Trigger | null
    try {
        event = await resolveEvent(triggerWithEventRequest, organizationId, automationId)
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

    const user = await resolveUserInOrg(session.user.id, session.user.organizationId)
    if (!user) {
        return res.status(404).json({ error: "User not found" })
    }

    res.status(200).json({ received: true, message: "Trigger with event initiated" })

    runWithUserContext(user, async () => {
        const syntheticEvent = new SyntheticTriggerRuntime(event)
        const eventProcessor = new EventProcessor(syntheticEvent, user, { isManuallyTriggered: true, replayOfRunId: triggerWithEventRequest.runId })
        await eventProcessor.processSingleAgent(automationId)
    }).catch(error => {
        logger.error("Error processing trigger with event", { error, automationId })
    })
}

async function resolveEvent(triggerWithEventRequest: TriggerWithEventRequest, organizationId: string, automationId: string): Promise<Trigger | null> {
    if (triggerWithEventRequest.event) {
        return triggerWithEventRequest.event
    }

    if (triggerWithEventRequest.runId) {
        const serializedEvent = await fetchEventFromRunId(triggerWithEventRequest.runId, organizationId, automationId)
        if (!serializedEvent) {
            return null
        }
        return serializedEvent.event.data
    }

    throw new Error("Invalid trigger with event request")
}

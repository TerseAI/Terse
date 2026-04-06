import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { InputEvent } from "../integrations/abstract/InputEvent"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { getUserForOrg } from "../utility/workos"

export class WebhookEvent extends InputEvent {
    readonly integrationType = IntegrationType.WEBHOOK
    readonly eventType = "webhook"
    readonly body: Record<string, unknown>
    readonly headers: Record<string, string>
    readonly method: string
    private readonly agentId: string

    constructor(opts: { body: Record<string, unknown>; headers: Record<string, string>; method: string; agentId: string }) {
        super()
        this.body = opts.body
        this.headers = opts.headers
        this.method = opts.method
        this.agentId = opts.agentId
    }

    formatForAgentRunner(): string {
        const bodyStr = JSON.stringify(this.body, null, 2)
        return `Webhook request received.\n\nMethod: ${this.method}\n\nPayload:\n${bodyStr}`
    }

    debugLog(): string {
        return `Webhook Trigger (${this.method})`
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        return agentTrigger.config_type === InputConfigType.WEBHOOK_INPUT
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: "webhook",
            integration: IntegrationType.WEBHOOK,
            source: "Webhook Trigger",
            title: "Webhook Trigger",
            subheader: `${this.method} request`
        }
    }

    serializeMetadata(): Record<string, unknown> {
        return { body: this.body, headers: this.headers, method: this.method }
    }
}

export async function handleWebhookTrigger(req: Request, res: Response) {
    const { webhookToken } = req.params

    if (!webhookToken) {
        res.status(400).json({ error: "Missing webhook token" })
        return
    }

    const webhookConfig = await db().automation_webhook_configs.findUnique({
        where: { webhook_token: webhookToken },
        include: {
            automation_input: {
                include: { automation: true }
            }
        }
    })

    if (!webhookConfig || !webhookConfig.automation_input) {
        res.status(404).json({ error: "Webhook not found" })
        return
    }

    const automation = webhookConfig.automation_input.automation
    if (!automation.is_active) {
        res.status(200).json({ received: true, message: "Agent is paused, event ignored" })
        return
    }

    logger.info("🔗 Webhook trigger received", {
        webhookToken,
        automationId: automation.id,
        automationName: automation.name
    })

    // Acknowledge immediately
    res.status(200).json({ received: true })

    // Process asynchronously
    const user = await getUserForOrg(automation.user_id, automation.organization_id)
    if (!user) {
        logger.warn("User not found for webhook trigger", { userId: automation.user_id })
        return
    }

    runWithUserContext(user, async () => {
        const headers: Record<string, string> = {}
        for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === "string") headers[key] = value
        }

        const webhookEvent = new WebhookEvent({
            body: (req.body as Record<string, unknown>) ?? {},
            headers,
            method: req.method,
            agentId: automation.id
        })

        const eventProcessor = new EventProcessor(webhookEvent, user)
        await eventProcessor.processSingleAgent(automation.id)
    }).catch(error => {
        logger.error("❌ Error processing webhook trigger", { error, webhookToken, automationId: automation.id })
    })
}

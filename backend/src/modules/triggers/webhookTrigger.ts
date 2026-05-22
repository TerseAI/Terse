import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import { WebhookTrigger } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import logger, { runWithUserContext } from "../../common/logger"
import { TriggerRuntime } from "../../integrations/abstract/TriggerRuntime"
import { getUserForOrg } from "../../integrations/workos/helpers"
import { db } from "../../loaders/prisma"
import { EventProcessor } from "../../modules/agents/AgentRunner/EventProcessor"
import { AgentTriggerWithConfigs } from "../../types/prisma"

class WebhookTriggerRuntime extends TriggerRuntime<WebhookTrigger> {
    readonly integrationType = IntegrationType.WEBHOOK
    readonly data: WebhookTrigger
    private readonly agentId: string

    constructor(opts: { body: Record<string, unknown>; headers: Record<string, string>; method: string; agentId: string }) {
        super()
        this.data = {
            integrationType: IntegrationType.WEBHOOK,
            eventType: "webhook",
            body: opts.body,
            headers: opts.headers,
            method: opts.method
        }
        this.agentId = opts.agentId
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
            subheader: `${this.data.method} request`
        }
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

        const webhookEvent = new WebhookTriggerRuntime({
            body: (req.body as Record<string, unknown>) ?? {},
            headers,
            method: req.method,
            agentId: automation.id
        })

        const eventProcessor = new EventProcessor(webhookEvent, user)
        await eventProcessor.processSingleAgent(automation.id)
    }).catch(error => {
        logger.error("❌ Error processing webhook trigger", { error, automationId: automation.id })
    })
}

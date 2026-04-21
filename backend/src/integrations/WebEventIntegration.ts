import { InputConfigType } from "@prisma/client"
import Client from "parallel-web"
import { ApiRoutes, WebEventTrigger, buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { IntegrationInstance, IntegrationType, WebEventIntegrationMetadata } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { settings } from "../config/settings"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { getUserForOrg } from "../utility/workos"

import { FormFieldDefinition, FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration } from "./abstract/Integration"
import { TriggerRuntime } from "./abstract/TriggerRuntime"

export interface WebEventWebhookPayload {
    inputId: string
    rawBody: string | Buffer
    parsedJson: unknown
}

interface CreateMonitorBody {
    query: string
    frequency: {
        number: number
        unit: "h" | "d" | "w"
    }
    webhook: {
        url: string
        event_types: string[]
    }
    metadata: Record<string, string>
}

interface CreateMonitorResponse {
    monitor_id?: string
}

async function createMonitor(body: CreateMonitorBody): Promise<{ monitor_id?: string }> {
    const { query, frequency, webhook, metadata } = body

    if (frequency.number < 1 || frequency.number > 30) {
        throw new Error("Frequency must be between 1 and 30 days")
    }

    const client = new Client({ apiKey: settings.parallel.apiKey })
    const monitor = (await client.post("/v1alpha/monitors", {
        body: {
            query,
            frequency: `${frequency.number}${frequency.unit}`,
            webhook,
            metadata
        }
    })) as CreateMonitorResponse // casting based on the docs
    return { monitor_id: monitor.monitor_id }
}

async function parallelMonitorsDelete(monitorId: string): Promise<void> {
    const client = new Client({ apiKey: settings.parallel.apiKey })
    await client.delete(`/v1alpha/monitors/${monitorId}`)
}

export class WebEventIntegrationManager
    implements Integration<IntegrationInstance, WebEventWebhookPayload, typeof WebEventIntegrationMetadata, never>, FormIntegrationInstallation<IntegrationType.WEBEVENT>
{
    integrationType: IntegrationType = IntegrationType.WEBEVENT

    constructor() {}

    getFormFields(): FormFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(_organizationId: string): Promise<IntegrationInstance[]> {
        return []
    }

    formatIntegrationInstanceForAgent(_instance: IntegrationInstance): string {
        return "Web Event triggers are available for SDK agents."
    }

    async getAllActiveInstances(): Promise<IntegrationInstance[]> {
        return []
    }

    async processWebhookEvent(event: WebEventWebhookPayload): Promise<void> {
        const { inputId, parsedJson } = event

        const agentTrigger = await db().automation_inputs.findUnique({
            where: { id: inputId },
            include: {
                automation: true,
                webevent_config: true
            }
        })

        if (!agentTrigger?.webevent_config) {
            logger.warn("Web event trigger: input not found or missing config", { inputId })
            return
        }

        const channel = agentTrigger.automation
        if (!channel) {
            logger.warn("Web event trigger: automation not found", { inputId })
            return
        }

        if (!channel.is_active) {
            logger.info("Web event received but automation is inactive", { inputId, automationId: channel.id })
            return
        }

        const user = await getUserForOrg(agentTrigger.automation.user_id, channel.organization_id)
        if (!user) {
            logger.warn("User not found for web event trigger", { userId: agentTrigger.automation.user_id })
            return
        }

        const cfg = agentTrigger.webevent_config
        const payloadRecord: Record<string, unknown> = parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson) ? { ...(parsedJson as Record<string, unknown>) } : {}

        await runWithUserContext(user, async () => {
            const runtime = new WebEventTriggerRuntime({
                inputId,
                query: cfg.query,
                frequency: { number: cfg.frequency_number, unit: cfg.frequency_unit },
                payload: payloadRecord
            })
            const eventProcessor = new EventProcessor(runtime, user, { isManuallyTriggered: false })
            await eventProcessor.processSingleAgent(agentTrigger.automation.id)
        })
    }

    async deleteInstallation(_integrationId: string): Promise<void> {}

    async setupAgentTrigger(_integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        const cfg = agentTrigger.webevent_config
        if (!cfg) {
            logger.warn("No webevent_config for input, skipping monitor setup", { inputId: agentTrigger.id })
            return
        }

        if (cfg.provider_monitor_id) {
            logger.info("Parallel monitor already linked for web event input", {
                inputId: agentTrigger.id,
                providerMonitorId: cfg.provider_monitor_id
            })
            return
        }

        const webhookUrl = this.getWebhookUrl(agentTrigger.id)
        try {
            const created = await createMonitor({
                query: cfg.query,
                frequency: { number: cfg.frequency_number, unit: cfg.frequency_unit },
                webhook: {
                    url: webhookUrl,
                    event_types: ["monitor.event.detected", "monitor.execution.completed", "monitor.execution.failed"]
                },
                metadata: {
                    terse_automation_input_id: agentTrigger.id,
                    terse_automation_id: agentTrigger.automation_id
                }
            })
            const monitorId = created.monitor_id
            if (!monitorId) {
                throw new Error("Parallel monitor create response missing monitor_id")
            }
            await db().automation_webevent_configs.update({
                where: { id: cfg.id },
                data: { provider_monitor_id: monitorId }
            })
            logger.info("Created Parallel monitor for web event trigger", {
                inputId: agentTrigger.id,
                providerMonitorId: monitorId
            })
        } catch (error) {
            logger.error("Failed to create Parallel monitor for web event trigger", {
                error,
                inputId: agentTrigger.id
            })
            throw error
        }
    }

    async teardownAgentTrigger(_integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        const cfg = agentTrigger.webevent_config
        if (!cfg?.provider_monitor_id) {
            return
        }
        try {
            await parallelMonitorsDelete(cfg.provider_monitor_id)
            logger.info("Deleted Parallel monitor for web event trigger", {
                inputId: agentTrigger.id,
                providerMonitorId: cfg.provider_monitor_id
            })
        } catch (error) {
            logger.error("Failed to delete Parallel monitor", { error, inputId: agentTrigger.id })
            throw error
        }
    }

    async processFormSubmission(_input: FormSubmissionInput): Promise<FormSubmissionResult> {
        return {
            success: false,
            error: "Web Event is a system integration and cannot be installed",
            statusCode: 400
        }
    }

    private getWebhookUrl(inputId: string): string {
        const baseUrl = settings.urls.backend
        const path = buildRoute(ApiRoutes.WEBHOOKS.WEBEVENT_BY_INPUT_ID, { inputId })
        return `${baseUrl}${path}`
    }
}

export class WebEventTriggerRuntime extends TriggerRuntime<WebEventTrigger> {
    readonly integrationType = IntegrationType.WEBEVENT
    data: WebEventTrigger

    constructor(params: { inputId: string; query: string; frequency: { number: number; unit: "h" | "d" | "w" }; payload: Record<string, unknown> }) {
        super()
        this.data = {
            integrationType: IntegrationType.WEBEVENT,
            eventType: "web_event",
            inputId: params.inputId,
            query: params.query,
            frequency: { number: params.frequency.number, unit: params.frequency.unit },
            payload: params.payload
        }
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.WEBEVENT_MONITOR) {
            return false
        }
        return agentTrigger.id === this.data.inputId
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: "web_event",
            integration: IntegrationType.WEBEVENT,
            source: "Web Event",
            title: "Web Event",
            subheader: "Scheduled web monitoring",
            url: buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: this.data.inputId })
        }
    }
}

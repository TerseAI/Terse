import { InputConfigType } from "@prisma/client"
import Client from "parallel-web"
import {
    ApiRoutes,
    ParallelMonitorDetectedWebhookPayload,
    ParallelMonitorDetectedWebhookPayloadSchema,
    ParallelMonitorEvent,
    ParallelMonitorEventSchema,
    WebMonitorTrigger,
    buildRoute
} from "terse-types"
import { FormFieldDefinition } from "terse-types"
import { ConfigData, ConfigType, FrequencyUnit, WebMonitorOutputSchema } from "terse-types/Configs"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { IntegrationInstance, IntegrationType, WebMonitorIntegrationMetadata } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { settings } from "../config/settings"
import { Identifiable } from "../hydrators/Hydrator"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { getUserForOrg } from "../utility/workos"

import { FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, createNotConnectedCliDisplayState } from "./abstract/Integration"
import { TriggerRuntime } from "./abstract/TriggerRuntime"

export class WebMonitorIntegrationManager
    extends Integration<IntegrationInstance, WebMonitorWebhookPayload, typeof WebMonitorIntegrationMetadata, never>
    implements FormIntegrationInstallation<IntegrationType.WEBMONITOR>
{
    readonly integrationType = IntegrationType.WEBMONITOR

    getFormFields(): FormFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(_organizationId: string): Promise<IntegrationInstance[]> {
        return []
    }

    async getCliDisplayStateForOrganization(_organizationId: string) {
        return createNotConnectedCliDisplayState()
    }

    formatIntegrationInstanceForAgent(_instance: IntegrationInstance): string {
        return "Web Event triggers are available for SDK agents."
    }

    async getAllActiveInstances(): Promise<IntegrationInstance[]> {
        return []
    }

    async getSampleEvents(_integrationId: string, organizationId: string, _userId: string, triggerConfig: ConfigData, options?: { limit?: number; triggerId?: string }): Promise<TriggerRuntime[]> {
        if (triggerConfig.configType !== ConfigType.WEBMONITOR) {
            return []
        }

        const limit = options?.limit ?? 5

        const triggerId = options?.triggerId
        if (!triggerId) {
            return []
        }

        const exact = await db().automation_webmonitor_configs.findFirst({
            where: {
                automation_input_id: triggerId,
                automation_input: {
                    automation: {
                        organization_id: organizationId
                    }
                }
            },
            select: {
                provider_monitor_id: true
            }
        })
        const providerMonitorId = exact?.provider_monitor_id
        if (!providerMonitorId) {
            return []
        }

        const [monitorConfig, historicalEvents] = await Promise.all([getMonitor(providerMonitorId), listMonitorEvents(providerMonitorId)])

        return historicalEvents.slice(0, limit).map(
            event =>
                new WebMonitorTriggerRuntime({
                    inputId: options?.triggerId ?? "sample",
                    automationId: "sample",
                    query: monitorConfig.query,
                    frequency: monitorConfig.frequency,
                    monitorId: providerMonitorId,
                    eventGroupId: event.event_group_id,
                    metadata: {},
                    event
                })
        )
    }

    async processWebhookEvent(event: WebMonitorWebhookPayload): Promise<void> {
        const { inputId, parsedJson } = event

        const agentTrigger = await db().automation_inputs.findUnique({
            where: { id: inputId },
            include: {
                automation: true,
                webmonitor_config: true
            }
        })

        if (!agentTrigger?.webmonitor_config) {
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

        const cfg = agentTrigger.webmonitor_config
        const payload = ParallelMonitorDetectedWebhookPayloadSchema.parse(parsedJson)
        const monitorId = payload.data.monitor_id
        const eventGroupId = payload.data.event.event_group_id
        const metadata = payload.data.metadata

        if (!cfg.provider_monitor_id) {
            logger.warn("Web event trigger missing provider monitor id", { inputId })
            return
        }

        if (cfg.provider_monitor_id !== monitorId) {
            logger.warn("Web event trigger monitor_id mismatch", {
                inputId,
                storedMonitorId: cfg.provider_monitor_id,
                webhookMonitorId: monitorId
            })
            return
        }

        const [monitorConfig, events] = await Promise.all([getMonitor(monitorId), getEventGroup(monitorId, eventGroupId)])

        if (events.length === 0) {
            logger.warn("Web event trigger event group returned no events", { inputId, monitorId, eventGroupId })
            return
        }

        for (const fetchedEvent of events) {
            await runWithUserContext(user, async () => {
                const runtime = new WebMonitorTriggerRuntime({
                    inputId,
                    automationId: agentTrigger.automation_id,
                    query: monitorConfig.query,
                    frequency: monitorConfig.frequency,
                    monitorId,
                    eventGroupId,
                    metadata,
                    event: fetchedEvent
                })
                const eventProcessor = new EventProcessor(runtime, user, { isManuallyTriggered: false })
                await eventProcessor.processSingleAgent(agentTrigger.automation.id)
            })
        }
    }

    async deleteInstallation(_integrationId: string): Promise<void> {}

    async setupAgentTrigger(_integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        const cfg = agentTrigger.webmonitor_config
        if (!cfg) {
            logger.warn("No webmonitor_config for input, skipping monitor setup", { inputId: agentTrigger.id })
            return
        }

        if (cfg.provider_monitor_id) {
            logger.info("Parallel monitor already linked for web event input", {
                inputId: agentTrigger.id,
                providerMonitorId: cfg.provider_monitor_id
            })
            return
        }

        logger.warn("Web event trigger has no provider_monitor_id — monitor should have been created during addTriggerToAgent", { inputId: agentTrigger.id })
    }

    async teardownAgentTrigger(_integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        const cfg = agentTrigger.webmonitor_config
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
}

export function buildWebhookUrl(inputId: string): string {
    const baseUrl = settings.urls.backend
    const path = buildRoute(ApiRoutes.WEBHOOKS.WEBMONITOR_BY_INPUT_ID, { inputId })
    return `${baseUrl}${path}`
}

export class WebMonitorTriggerRuntime extends TriggerRuntime<WebMonitorTrigger<unknown>> implements Identifiable {
    readonly integrationType = IntegrationType.WEBMONITOR
    readonly entityType = "webmonitor_event"
    readonly entityId: string
    data: WebMonitorTrigger<unknown>
    private readonly automationId: string

    constructor(params: {
        inputId: string
        automationId: string
        query: string
        frequency: { number: number; unit: FrequencyUnit }
        monitorId: string
        eventGroupId: string
        metadata: Record<string, string>
        event: ParallelMonitorEvent
    }) {
        super()
        this.automationId = params.automationId
        const payload = params.event.result.content
        const rawPayload = params.event.result.type === "json" ? params.event.output || JSON.stringify(params.event.result.content) : undefined
        this.entityId = `${params.monitorId}:${params.eventGroupId}:${encodeURIComponent(params.event.event_date)}`
        this.data = {
            integrationType: IntegrationType.WEBMONITOR,
            eventType: "webmonitor",
            inputId: params.inputId,
            query: params.query,
            frequency: { number: params.frequency.number, unit: params.frequency.unit },
            monitorId: params.monitorId,
            eventGroupId: params.eventGroupId,
            metadata: params.metadata,
            outputType: params.event.result.type,
            payload,
            ...(rawPayload ? { rawPayload } : {}),
            eventDate: params.event.event_date,
            sourceUrls: params.event.source_urls
        }
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.WEBMONITOR) {
            return false
        }
        return agentTrigger.id === this.data.inputId
    }

    createTriggerMetadata(): RunHistoryTrigger {
        const firstSourceUrl = this.data.sourceUrls[0]
        return {
            event: "webmonitor",
            integration: IntegrationType.WEBMONITOR,
            source: extractWebMonitorSource(this.data.query, firstSourceUrl),
            title: extractWebMonitorTitle(this.data.payload, this.data.rawPayload),
            subheader: extractWebMonitorSubheader(this.data.query, this.data.eventDate),
            url: firstSourceUrl || buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: this.automationId })
        }
    }
}

interface WebMonitorWebhookPayload {
    inputId: string
    rawBody: string | Buffer
    parsedJson: ParallelMonitorDetectedWebhookPayload
}

interface CreateMonitorBody {
    query: string
    frequency: {
        number: number
        unit: FrequencyUnit
    }
    webhook: {
        url: string
        event_types: string[]
    }
    metadata: Record<string, string>
    output_schema?: WebMonitorOutputSchema
}

function toParallelOutputSchema(outputSchema?: WebMonitorOutputSchema): { type: "json"; json_schema: Record<string, unknown> } | undefined {
    if (!outputSchema) {
        return undefined
    }

    const jsonSchema = JSON.parse(JSON.stringify(outputSchema.jsonSchema))
    if ("~standard" in jsonSchema) {
        delete jsonSchema["~standard"]
    }

    return {
        type: "json",
        json_schema: jsonSchema
    }
}

interface CreateMonitorResponse {
    monitor_id?: string
}

export async function createMonitor(body: CreateMonitorBody): Promise<{ monitor_id?: string }> {
    const { query, frequency, webhook, metadata, output_schema } = body

    const frequencyUnit = frequency.unit === "hour" ? "h" : frequency.unit === "day" ? "d" : "w"

    if (frequency.number < 1 || frequency.number > 30) {
        throw new Error("Frequency must be between 1 and 30 days")
    }

    const client = new Client({ apiKey: settings.parallel.apiKey })
    const monitor = (await client.post("/v1alpha/monitors", {
        body: {
            query,
            frequency: `${frequency.number}${frequencyUnit}`,
            webhook,
            metadata,
            output_schema: toParallelOutputSchema(output_schema)
        }
    })) as CreateMonitorResponse // casting based on the docs
    return { monitor_id: monitor.monitor_id }
}

interface GetMonitorResponse {
    query: string
    frequency: { number: number; unit: FrequencyUnit }
    outputSchema?: WebMonitorOutputSchema
}

export async function getMonitor(monitorId: string): Promise<GetMonitorResponse> {
    const client = new Client({ apiKey: settings.parallel.apiKey })
    const response = (await client.get(`/v1alpha/monitors/${monitorId}`)) as {
        query: string
        frequency: string
        output_schema?: { type: "json"; json_schema: Record<string, unknown> } | null
    }
    const outputSchema: WebMonitorOutputSchema | undefined = response.output_schema ? { type: "json", jsonSchema: response.output_schema.json_schema } : undefined
    return {
        query: response.query,
        frequency: parseParallelFrequency(response.frequency),
        outputSchema
    }
}

function parseParallelFrequency(frequency: string): { number: number; unit: FrequencyUnit } {
    const match = frequency.match(/^(\d+)(h|d|w)$/)
    if (!match) {
        throw new Error(`Unexpected Parallel frequency format: ${frequency}`)
    }
    const num = parseInt(match[1], 10)
    const unitMap: Record<string, FrequencyUnit> = { h: "hour", d: "day", w: "week" }
    return { number: num, unit: unitMap[match[2]] }
}

async function parallelMonitorsDelete(monitorId: string): Promise<void> {
    const client = new Client({ apiKey: settings.parallel.apiKey })
    await client.delete(`/v1alpha/monitors/${monitorId}`)
}

export async function getEventGroup(monitorId: string, eventGroupId: string): Promise<ParallelMonitorEvent[]> {
    const client = new Client({ apiKey: settings.parallel.apiKey })
    const response = (await client.get(`/v1alpha/monitors/${monitorId}/event_groups/${eventGroupId}`)) as {
        events?: unknown[]
    }

    return (response.events ?? []).map(event => ParallelMonitorEventSchema.parse(event))
}

async function listMonitorEvents(monitorId: string, lookbackPeriod: string = "10d"): Promise<ParallelMonitorEvent[]> {
    const client = new Client({ apiKey: settings.parallel.apiKey })
    const response = (await client.get(`/v1alpha/monitors/${monitorId}/events?lookback_period=${encodeURIComponent(lookbackPeriod)}`)) as {
        events?: Array<unknown>
    }

    return (response.events ?? [])
        .filter((event): event is Record<string, unknown> => !!event && typeof event === "object" && !Array.isArray(event))
        .filter(event => event.type === "event")
        .map(event => ParallelMonitorEventSchema.parse(event))
}

function truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function firstNonEmptyString(values: Array<unknown>): string | undefined {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim()
        }
    }
    return undefined
}

function extractWebMonitorTitle(payload: unknown, rawPayload?: string): string {
    if (typeof payload === "string" && payload.trim()) {
        return truncate(payload.trim(), 100)
    }

    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const record = payload as Record<string, unknown>
        const candidate = firstNonEmptyString([record.summary, record.title, record.headline, record.description, record.output])
        if (candidate) {
            return truncate(candidate, 100)
        }
    }

    if (rawPayload?.trim()) {
        return truncate(rawPayload.trim(), 100)
    }

    return "Web Monitor"
}

function extractWebMonitorSubheader(query: string, eventDate: string): string {
    return `${truncate(query.trim(), 80)}${eventDate ? ` • ${eventDate}` : ""}`
}

function extractWebMonitorSource(query: string, firstSourceUrl?: string): string {
    if (firstSourceUrl) {
        try {
            return new URL(firstSourceUrl).hostname
        } catch {
            return firstSourceUrl
        }
    }

    return truncate(query.trim(), 80) || "Web Monitor"
}

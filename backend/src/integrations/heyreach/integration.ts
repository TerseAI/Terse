import { InputConfigType } from "@prisma/client"
import { HeyReachEventType, HeyReachTrigger, HeyReachWebhookPayload } from "terse-types"
import { FormFieldDefinition, FormIntegrationSetup } from "terse-types"
import { ConfigData, ConfigType } from "terse-types/Configs"
import { HeyReachIntegration, HeyReachIntegrationMetadata, IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { z } from "zod"

import logger from "../../common/logger"
import { buildHeyReachWebhookUrl } from "../../common/webhookUrl"
import { EventProcessor } from "../../domains/agents/AgentRunner/EventProcessor"
import { getUserForOrg } from "../../integrations/workos/helpers"
import { db } from "../../loaders/prisma"
import { SecretService } from "../../services/SecretService"
import { AgentTriggerWithConfigs, PrismaTransaction } from "../../types/prisma"
import { FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"
import { TriggerRuntime } from "../abstract/TriggerRuntime"

const HEYREACH_API_BASE = "https://api.heyreach.io/api/public"

interface HeyReachWebhookRequest {
    triggerId: string
    payload: HeyReachWebhookPayload
}

export class HeyReachIntegrationManager
    extends Integration<HeyReachIntegration, HeyReachWebhookRequest, typeof HeyReachIntegrationMetadata, never>
    implements FormIntegrationInstallation<IntegrationType.HEY_REACH>
{
    readonly integrationType = IntegrationType.HEY_REACH
    readonly secretSchema = z.object({
        apiKey: z.string()
    })

    async getInstancesForOrganization(organizationId: string): Promise<HeyReachIntegration[]> {
        const integrations = await db().hey_reach_integrations.findMany({
            where: { organization_id: organizationId },
            select: { id: true }
        })
        return integrations.map(i => this.enrichInstance(i.id))
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const [integration] = await this.getInstancesForOrganization(organizationId)
        if (!integration) {
            return createNotConnectedCliDisplayState()
        }
        return createConnectedCliDisplayState("HeyReach", "Connected", integration.id)
    }

    formatIntegrationInstanceForAgent(instance: HeyReachIntegration): string {
        return `HeyReach [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<HeyReachIntegration[]> {
        const integrations = await db().hey_reach_integrations.findMany({ select: { id: true } })
        return integrations.map(i => this.enrichInstance(i.id))
    }

    private enrichInstance(id: string): HeyReachIntegration {
        return { id }
    }

    async processWebhookEvent(request: HeyReachWebhookRequest): Promise<void> {
        const { triggerId, payload } = request

        const subscribedTrigger = await db().automation_inputs.findFirst({
            where: { id: triggerId, config_type: InputConfigType.HEY_REACH_INPUT },
            include: { automation: true }
        })
        if (!subscribedTrigger) {
            logger.info("HeyReach webhook: no agent triggers subscribed, dropping", { triggerId, event_type: payload.event_type })
            return
        }

        const user = await getUserForOrg(subscribedTrigger.automation.user_id, subscribedTrigger.automation.organization_id)
        if (!user) {
            logger.warn("HeyReach webhook: user not found", {
                userId: subscribedTrigger.automation.user_id,
                organizationId: subscribedTrigger.automation.organization_id
            })
            return
        }

        const event = new HeyReachTriggerRuntime(payload, subscribedTrigger.integration_id)
        const processor = new EventProcessor(event, user)
        const results = await processor.process()
        for (const result of results) {
            if (result.success) {
                logger.info("HeyReach event processed", { integrationId: subscribedTrigger.integration_id, event_type: payload.event_type, agentId: result.agentConfig?.id })
            }
        }
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        await db().$transaction(async tx => {
            await tx.hey_reach_integrations.delete({ where: { id: integrationId } })
        })
        await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.HEY_REACH, recordId: integrationId } })
    }

    async setupAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}

    async teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        if (agentTrigger.config_type !== InputConfigType.HEY_REACH_INPUT) return
        if (!agentTrigger.hey_reach_config?.webhook_id) return

        const webhookId = agentTrigger.hey_reach_config.webhook_id

        logger.info("HeyReach teardown: deactivating webhook", { webhookId, integrationId })
        try {
            await updateHeyReachWebhook(webhookId, integrationId, false)
        } catch (error) {
            logger.error("HeyReach teardown: failed to update webhook", { error, webhookId, integrationId })
        }

        logger.info("HeyReach teardown: deleting webhook", { webhookId, integrationId })
        try {
            await deleteHeyReachWebhook(webhookId, integrationId)
        } catch (error) {
            logger.error("HeyReach teardown: failed to delete webhook", { error, webhookId, integrationId })
        }
    }

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: "apiKey",
                type: "password",
                label: "API Key",
                placeholder: "Enter your HeyReach API key",
                required: true,
                hint: "Generate an API key in HeyReach under Integrations & API."
            }
        ]
    }

    getFormSetup(): FormIntegrationSetup {
        return {
            title: "Connect HeyReach",
            url: "https://app.heyreach.io/app/integrations/public-api/api",
            instructions: ["Generate an API key in HeyReach under Integrations & API."]
        }
    }

    async processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult> {
        const { organizationId, formValues } = input
        const { apiKey } = formValues

        if (!apiKey || typeof apiKey !== "string") {
            return { success: false, error: "API key is required", statusCode: 400 }
        }

        try {
            const validationResponse = await fetch(`${HEYREACH_API_BASE}/auth/CheckApiKey`, {
                method: "GET",
                headers: { "X-API-KEY": apiKey }
            })

            if (!validationResponse.ok) {
                logger.error("HeyReach API key validation failed", { status: validationResponse.status })
                return {
                    success: false,
                    error: "Invalid API key",
                    statusCode: 400,
                    data: { details: validationResponse.status === 401 ? "Authentication failed" : "API key validation failed" }
                }
            }

            const existing = await db().hey_reach_integrations.findFirst({ where: { organization_id: organizationId } })

            let integrationId: string
            if (existing) {
                await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.HEY_REACH, recordId: existing.id, value: { apiKey: apiKey } } })
                integrationId = existing.id
                logger.info("Updated HeyReach integration", { integrationId })
            } else {
                const integration = await db().hey_reach_integrations.create({ data: { organization_id: organizationId } })
                await this.secretService.createSecrets({ type: "integration", secret: { integrationType: IntegrationType.HEY_REACH, recordId: integration.id, value: { apiKey: apiKey } } })
                integrationId = integration.id
                logger.info("Created HeyReach integration", { integrationId })
            }

            return {
                success: true,
                statusCode: 200,
                data: {
                    integrationId
                }
            }
        } catch (error) {
            logger.error("Error processing HeyReach form submission", { error })
            return { success: false, error: "Failed to process integration", statusCode: 500 }
        }
    }

    async getSampleEvents(_integrationId: string, _organizationId: string, _userId: string, triggerConfig: ConfigData): Promise<TriggerRuntime[]> {
        if (triggerConfig.configType !== ConfigType.HEY_REACH_INPUT) return []
        return []
    }
}

class HeyReachTriggerRuntime extends TriggerRuntime<HeyReachTrigger> {
    readonly integrationType = IntegrationType.HEY_REACH
    data: HeyReachTrigger
    private integrationId: string

    constructor(payload: HeyReachWebhookPayload, integrationId: string) {
        super()
        this.data = buildHeyReachTrigger(payload)
        this.integrationId = integrationId
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.HEY_REACH_INPUT) return false
        if (agentTrigger.integration_id !== this.integrationId) return false
        const config = agentTrigger.hey_reach_config
        if (!config?.event_type) return false
        if (config.event_type !== this.data.eventType) return false
        if (config.campaign_ids.length === 0) return true
        const campaignId = this.data.campaign?.id
        if (campaignId === undefined) return false
        return config.campaign_ids.includes(String(campaignId))
    }

    createTriggerMetadata(): RunHistoryTrigger {
        const lead = this.data.lead
        const leadName = lead ? [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || lead.full_name?.trim() || (lead.id != null ? String(lead.id) : undefined) : undefined
        return {
            event: this.data.eventType,
            integration: IntegrationType.HEY_REACH,
            source: "HeyReach",
            title: this.data.eventType
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, c => c.toUpperCase()),
            subheader: leadName || this.data.campaign?.name || ""
        }
    }
}

function normalizeEventType(rawEvent: string): HeyReachEventType | null {
    const upper = rawEvent.toUpperCase()
    if ((Object.values(HeyReachEventType) as string[]).includes(upper)) {
        return upper as HeyReachEventType
    }
    return null
}

function buildHeyReachTrigger(payload: HeyReachWebhookPayload): HeyReachTrigger {
    const eventType = normalizeEventType(payload.event_type)
    if (!eventType) {
        throw new Error(`Unsupported HeyReach event: ${payload.event_type}`)
    }

    const base = {
        integrationType: IntegrationType.HEY_REACH as const,
        eventType,
        eventId: payload.correlation_id ?? "",
        createdAt: payload.timestamp ?? new Date().toISOString(),
        lead: payload.lead as HeyReachTrigger["lead"],
        campaign: payload.campaign as HeyReachTrigger["campaign"],
        linkedInAccount: payload.sender as HeyReachTrigger["linkedInAccount"],
        rawPayload: payload as Record<string, unknown>
    }

    const messageText = typeof payload.message_body === "string" ? payload.message_body : typeof payload.connection_message === "string" ? payload.connection_message : undefined

    switch (eventType) {
        case HeyReachEventType.MESSAGE_SENT:
        case HeyReachEventType.MESSAGE_REPLY_RECEIVED:
        case HeyReachEventType.INMAIL_SENT:
        case HeyReachEventType.INMAIL_REPLY_RECEIVED:
            return { ...base, eventType, messageBody: messageText }
        case HeyReachEventType.LIKED_POST:
            return { ...base, eventType, postUrl: typeof payload.post_url === "string" ? payload.post_url : undefined }
        case HeyReachEventType.LEAD_TAG_UPDATED:
            return {
                ...base,
                eventType,
                tags: Array.isArray(payload.tags) ? payload.tags.filter((t): t is string => typeof t === "string") : undefined
            }
        default:
            return { ...base, eventType }
    }
}

const heyReachCampaignsRequestSchema = z.object({
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    keyword: z.string().nullable()
})

const heyReachCampaignsResponseSchema = z.object({
    items: z
        .array(
            z
                .object({
                    id: z.union([z.string(), z.number()]),
                    name: z.string().optional()
                })
                .passthrough()
        )
        .default([]),
    totalCount: z.number().int().optional()
})

export type HeyReachCampaign = { id: string; name: string }

export async function fetchHeyReachCampaigns(organizationId: string, integrationId: string): Promise<HeyReachCampaign[]> {
    const integration = await db().hey_reach_integrations.findFirst({ where: { id: integrationId, organization_id: organizationId } })
    if (!integration) {
        throw new Error("HeyReach integration not found")
    }
    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.HEY_REACH, recordId: integration.id } })
    const apiKey = secrets.apiKey

    const requestBody = heyReachCampaignsRequestSchema.parse({ offset: 0, limit: 100, keyword: null })
    const response = await fetch(`${HEYREACH_API_BASE}/campaign/GetAll`, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    })
    if (!response.ok) {
        const errorText = await response.text()
        logger.error("Failed to fetch HeyReach campaigns", { status: response.status, errorText })
        throw new Error(response.status === 401 ? "Invalid API key" : "Failed to fetch HeyReach campaigns")
    }

    const data = heyReachCampaignsResponseSchema.parse(await response.json())
    return data.items.map(c => ({ id: String(c.id), name: c.name || `Campaign ${c.id}` }))
}

const HEYREACH_WEBHOOK_NAME_MAX_LEN = 25
const heyReachWebhookRequestSchema = z.object({
    webhookName: z.string().max(HEYREACH_WEBHOOK_NAME_MAX_LEN),
    webhookUrl: z.string().url(),
    eventType: z.string(),
    campaignIds: z.array(z.string()).optional()
})

const heyReachWebhookResponseSchema = z.object({
    webhookId: z.number()
})

function clipHeyReachWebhookName(eventType: HeyReachEventType): string {
    const base = `T:${eventType}`
    return base.length <= HEYREACH_WEBHOOK_NAME_MAX_LEN ? base : base.slice(0, HEYREACH_WEBHOOK_NAME_MAX_LEN)
}

export async function createHeyReachWebhook(tx: PrismaTransaction, triggerId: string, integrationId: string, eventType: HeyReachEventType, campaignIds: string[] = []) {
    const heyReachRow = await tx.hey_reach_integrations.findUnique({ where: { id: integrationId } })
    if (!heyReachRow) {
        throw new Error("HeyReach integration not found")
    }

    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.HEY_REACH, recordId: integrationId } })
    const apiKey = secrets.apiKey

    const webhookName = clipHeyReachWebhookName(eventType)
    const webhookUrl = buildHeyReachWebhookUrl(triggerId)

    const requestBody = heyReachWebhookRequestSchema.parse({ webhookName, webhookUrl, eventType, campaignIds })
    const response = await fetch(`${HEYREACH_API_BASE}/webhooks/CreateWebhook`, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    })

    const data = heyReachWebhookResponseSchema.parse(await response.json())
    if (!response.ok) {
        logger.error("HeyReach CreateWebhook failed", { status: response.status, body: data, webhookName, eventType })
        throw new Error(response.status === 400 ? `HeyReach rejected webhook: ${data}` : "Failed to create HeyReach webhook")
    }

    logger.info("HeyReach CreateWebhook succeeded", { webhookId: data.webhookId, webhookName, eventType })

    return data.webhookId
}

async function deleteHeyReachWebhook(webhookId: number, integrationId: string) {
    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.HEY_REACH, recordId: integrationId } })
    const apiKey = secrets.apiKey

    const url = new URL(`${HEYREACH_API_BASE}/webhooks/DeleteWebhook`)
    url.searchParams.set("webhookId", String(webhookId))

    const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
            Accept: "text/plain"
        }
    })

    const responseText = await response.text()
    if (!response.ok) {
        logger.error("HeyReach DeleteWebhook failed", { status: response.status, body: responseText, webhookId })
        throw new Error(response.status === 400 ? `HeyReach rejected webhook: ${responseText}` : "Failed to delete HeyReach webhook")
    }

    logger.info("HeyReach DeleteWebhook succeeded", { webhookId })
}

const heyReachUpdateWebhookRequestSchema = z.object({
    isActive: z.boolean()
})

async function updateHeyReachWebhook(webhookId: number, integrationId: string, isActive: boolean) {
    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.HEY_REACH, recordId: integrationId } })
    const apiKey = secrets.apiKey

    const url = new URL(`${HEYREACH_API_BASE}/webhooks/UpdateWebhook`)
    url.searchParams.set("webhookId", String(webhookId))

    const payload = heyReachUpdateWebhookRequestSchema.parse({ isActive })

    const response = await fetch(url.toString(), {
        method: "PATCH",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    if (!response.ok) {
        logger.error("HeyReach UpdateWebhook failed", { status: response.status, body: responseText, webhookId })
        throw new Error(response.status === 400 ? `HeyReach rejected webhook update: ${responseText}` : "Failed to update HeyReach webhook")
    }

    logger.info("HeyReach UpdateWebhook succeeded", { webhookId })
}

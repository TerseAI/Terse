import { InputConfigType } from "@prisma/client"
import { HeyReachEventType, HeyReachTrigger, HeyReachWebhookPayload } from "terse-types"
import { ConfigData, ConfigType } from "terse-types/Configs"
import { HeyReachIntegration, HeyReachIntegrationMetadata, IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { z } from "zod"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { urls } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { Identifiable } from "../rag/Hydrator"
import { SecretField, deleteSecretsBestEffort, getSecret, storeSecret } from "../services/SecretService"
import { AgentTriggerWithConfigs, PrismaTransaction } from "../types/prisma"
import { getUserForOrg } from "../utility/workos"

import {
    FormFieldDefinition,
    FormIntegrationInstallation,
    FormIntegrationSetup,
    FormSubmissionInput,
    FormSubmissionResult,
    Integration,
    createConnectedCliDisplayState,
    createNotConnectedCliDisplayState
} from "./abstract/Integration"
import { TriggerRuntime } from "./abstract/TriggerRuntime"

const HEYREACH_API_BASE = "https://api.heyreach.io/api/public"

export interface HeyReachWebhookRequest {
    integrationId: string
    payload: HeyReachWebhookPayload
}

export class HeyReachIntegrationManager
    implements Integration<HeyReachIntegration, HeyReachWebhookRequest, typeof HeyReachIntegrationMetadata, never>, FormIntegrationInstallation<IntegrationType.HEY_REACH>
{
    integrationType: IntegrationType = IntegrationType.HEY_REACH

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
        return {
            id,
            webhookUrl: `${urls.backend}/webhooks/heyreach/${id}`
        }
    }

    async processWebhookEvent(request: HeyReachWebhookRequest): Promise<void> {
        const { integrationId, payload } = request

        const subscribedTrigger = await db().automation_inputs.findFirst({
            where: { integration_id: integrationId, config_type: InputConfigType.HEY_REACH_INPUT },
            include: { automation: true }
        })
        if (!subscribedTrigger) {
            logger.info("HeyReach webhook: no agent triggers subscribed, dropping", { integrationId, event: payload.event })
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

        const event = new HeyReachTriggerRuntime(payload, integrationId)
        const processor = new EventProcessor(event, user)
        const results = await processor.process()
        for (const result of results) {
            if (result.success) {
                logger.info("HeyReach event processed", { integrationId, event: payload.event, agentId: result.agentConfig?.id })
            }
        }
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        await db().hey_reach_integrations.delete({ where: { id: integrationId } })
        await deleteSecretsBestEffort([{ integrationType: IntegrationType.HEY_REACH, recordId: integrationId, field: SecretField.ApiKey }])
    }

    async setupAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}

    async teardownAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {}

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
            instructions: [
                "Generate an API key in HeyReach under Integrations & API.",
                "After saving, use the webhook URL Terse returns to create a webhook in HeyReach for the events you want to listen to."
            ]
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
                await storeSecret(IntegrationType.HEY_REACH, existing.id, SecretField.ApiKey, apiKey)
                integrationId = existing.id
                logger.info("Updated HeyReach integration", { integrationId })
            } else {
                const integration = await db().hey_reach_integrations.create({ data: { organization_id: organizationId } })
                await storeSecret(IntegrationType.HEY_REACH, integration.id, SecretField.ApiKey, apiKey)
                integrationId = integration.id
                logger.info("Created HeyReach integration", { integrationId })
            }

            return {
                success: true,
                statusCode: 200,
                data: {
                    integrationId,
                    webhookUrl: `${urls.backend}/webhooks/heyreach/${integrationId}`
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

export class HeyReachTriggerRuntime extends TriggerRuntime<HeyReachTrigger> {
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
        const leadName = lead ? [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || lead.linkedInId || lead.id : undefined
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
    const eventType = normalizeEventType(payload.event)
    if (!eventType) {
        throw new Error(`Unsupported HeyReach event: ${payload.event}`)
    }

    const base = {
        integrationType: IntegrationType.HEY_REACH as const,
        eventType,
        eventId: payload.eventId ?? "",
        createdAt: payload.timestamp ?? new Date().toISOString(),
        lead: payload.lead as HeyReachTrigger["lead"],
        campaign: payload.campaign as HeyReachTrigger["campaign"],
        linkedInAccount: payload.linkedInAccount as HeyReachTrigger["linkedInAccount"],
        rawPayload: payload as Record<string, unknown>
    }

    switch (eventType) {
        case HeyReachEventType.MESSAGE_SENT:
        case HeyReachEventType.MESSAGE_REPLY_RECEIVED:
        case HeyReachEventType.INMAIL_SENT:
        case HeyReachEventType.INMAIL_REPLY_RECEIVED:
            return { ...base, eventType, messageBody: typeof payload.messageBody === "string" ? payload.messageBody : undefined }
        case HeyReachEventType.LIKED_POST:
            return { ...base, eventType, postUrl: typeof payload.postUrl === "string" ? payload.postUrl : undefined }
        case HeyReachEventType.LEAD_TAG_UPDATED:
            return { ...base, eventType, tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : undefined }
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
    const apiKey = await getSecret(IntegrationType.HEY_REACH, integration.id, SecretField.ApiKey)
    if (!apiKey) {
        throw new Error("HeyReach API key not found")
    }

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

const heyReachWebhookRequestSchema = z.object({
    webhookName: z.string(),
    webhookUrl: z.string(),
    eventType: z.string(),
    campaignIds: z.array(z.string()).optional()
})

const heyReachWebhookResponseSchema = z.object({
    url: z.string()
})

export async function createHeyReachWebhook(tx: PrismaTransaction, triggerId: string, eventType: HeyReachEventType, campaignIds: string[] = []) {
    console.log("WTF: createHeyReachWebhook", triggerId, eventType, campaignIds)
    const automationInput = await tx.automation_inputs.findUnique({
        where: { id: triggerId },
        select: { integration_id: true, config_type: true }
    })
    if (!automationInput || automationInput.config_type !== InputConfigType.HEY_REACH_INPUT) {
        throw new Error("HeyReach trigger not found")
    }
    const integrationId = automationInput.integration_id

    const heyReachRow = await db().hey_reach_integrations.findUnique({ where: { id: integrationId } })
    if (!heyReachRow) {
        throw new Error("HeyReach integration not found")
    }

    const apiKey = await getSecret(IntegrationType.HEY_REACH, integrationId, SecretField.ApiKey)
    if (!apiKey) {
        throw new Error("HeyReach API key not found")
    }

    const webhookName = `Terse ${eventType}`
    const webhookUrl = `${urls.backend}/webhooks/heyreach/${triggerId}`

    const requestBody = heyReachWebhookRequestSchema.parse({ webhookName, webhookUrl, eventType, campaignIds })
    const response = await fetch(`${HEYREACH_API_BASE}/webhooks/CreateWebhook`, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    })

    console.log("WTF: HeyReach webhook creation response", response)

    const data = heyReachWebhookResponseSchema.parse(await response.json())

    return data.url
}

import { InputConfigType } from "@prisma/client"
import { ConfigInstance, ConfigType, WorkOSEventType, WorkOSInputConfig } from "terse-types/Configs"
import { IntegrationType, WorkOSIntegration, WorkOSIntegrationMetadata } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { urls } from "../config/settings"
import logger from "../logger"
import { WorkOSUserResponse, getWorkOSUser } from "../outputs/workos/workosApiClient"
import { db } from "../prismaClient"
import { Identifiable } from "../rag/Hydrator"
import { SecretField, deleteSecretsBestEffort, getSecret, storeSecret } from "../services/SecretService"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { HydratorType } from "../types/rag"
import { getUserForOrg } from "../utility/workos"

import { InputEvent } from "./abstract/InputEvent"
import { FormFieldDefinition, FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration } from "./abstract/Integration"

export const WORKOS_SUPPORTED_EVENT_NAMES = Object.values(WorkOSEventType) as [WorkOSEventType, ...WorkOSEventType[]]

export type WorkOSEventName = WorkOSEventType

export class WorkOSIntegrationManager implements Integration<WorkOSIntegration, WorkOSWebhookRequest, typeof WorkOSIntegrationMetadata, never>, FormIntegrationInstallation<IntegrationType.WORKOS> {
    integrationType: IntegrationType = IntegrationType.WORKOS

    async getInstancesForOrganization(organizationId: string): Promise<WorkOSIntegration[]> {
        const integrations = await db().workos_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true
            }
        })
        return Promise.all(
            integrations.map(async i => {
                const apiKey = await getSecret(IntegrationType.WORKOS, i.id, SecretField.ApiKey)
                return this.enrichInstance(i.id, apiKey || "")
            })
        )
    }

    formatIntegrationInstanceForAgent(instance: WorkOSIntegration): string {
        const env = instance.environment ? ` (${instance.environment})` : ""
        return `WorkOS${env} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<WorkOSIntegration[]> {
        const integrations = await db().workos_integrations.findMany({
            select: {
                id: true
            }
        })
        return Promise.all(
            integrations.map(async i => {
                const apiKey = await getSecret(IntegrationType.WORKOS, i.id, SecretField.ApiKey)
                return this.enrichInstance(i.id, apiKey || "")
            })
        )
    }

    private enrichInstance(id: string, apiKey: string): WorkOSIntegration {
        return {
            id,
            webhookUrl: `${urls.backend}/webhooks/workos-trigger/${id}`,
            environment: parseWorkOSEnvironment(apiKey)
        }
    }

    async processWebhookEvent(request: WorkOSWebhookRequest): Promise<void> {
        const { integrationId, payload } = request
        const integration = await db().workos_integrations.findUnique({
            where: { id: integrationId }
        })

        if (!integration) {
            logger.warn("WorkOS webhook received for unknown integration", { integrationId })
            return
        }

        const user = await getUserForOrg(integration.user_id, integration.organization_id)
        if (!user) {
            logger.warn("WorkOS webhook: user not found", { userId: integration.user_id, organizationId: integration.organization_id })
            return
        }

        const apiKey = await getSecret(IntegrationType.WORKOS, integrationId, SecretField.ApiKey)
        const enrichedPayload = apiKey ? await enrichWorkOSEventPayload(payload, apiKey) : payload
        const event = new WorkOSEvent(enrichedPayload, integrationId)
        const processor = new EventProcessor(event, user)
        const results = await processor.process()

        for (const result of results) {
            if (result.success) {
                logger.info("WorkOS event processed successfully", {
                    integrationId,
                    event: payload.event,
                    agentId: result.agentConfig?.id
                })
            }
        }
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        // DB-first, then best-effort GSM cleanup
        await db().workos_integrations.delete({ where: { id: integrationId } })

        await deleteSecretsBestEffort([
            { integrationType: IntegrationType.WORKOS, recordId: integrationId, field: SecretField.ApiKey },
            { integrationType: IntegrationType.WORKOS, recordId: integrationId, field: SecretField.WebhookSecret }
        ])
    }

    async setupAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Webhooks are managed externally by the user in their WorkOS dashboard
    }

    async teardownAgentTrigger(_integrationId: string, _agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Webhooks are managed externally by the user in their WorkOS dashboard
    }

    getFormFields(): FormFieldDefinition[] {
        return [
            {
                name: "apiKey",
                type: "password",
                label: "API Key",
                placeholder: "Enter your WorkOS API key",
                required: true,
                hint: "Your WorkOS API key can be found in your WorkOS dashboard under API Keys."
            },
            {
                name: "webhookSecret",
                type: "password",
                label: "Webhook Signing Secret",
                placeholder: "Enter your WorkOS webhook signing secret",
                required: false,
                hint: "The signing secret for verifying webhook payloads. You'll get this after creating the webhook endpoint in WorkOS."
            }
        ]
    }

    async processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult> {
        const { userId, organizationId, formValues } = input
        const { apiKey, webhookSecret } = formValues

        if (!apiKey || typeof apiKey !== "string") {
            return { success: false, error: "API key is required", statusCode: 400 }
        }

        const secret = webhookSecret && typeof webhookSecret === "string" ? webhookSecret : null

        try {
            // Validate API key by calling WorkOS API
            const validationResponse = await fetch("https://api.workos.com/user_management/users?limit=1", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            })

            if (!validationResponse.ok) {
                const errorText = await validationResponse.text()
                logger.error("WorkOS API key validation failed", {
                    status: validationResponse.status,
                    error: errorText
                })
                return {
                    success: false,
                    error: "Invalid API key",
                    statusCode: 400,
                    data: {
                        details: validationResponse.status === 401 ? "Authentication failed" : "API key validation failed"
                    }
                }
            }

            // Check if integration already exists for this organization
            const existing = await db().workos_integrations.findFirst({
                where: { organization_id: organizationId }
            })

            let integrationId: string

            if (existing) {
                await storeSecret(IntegrationType.WORKOS, existing.id, SecretField.ApiKey, apiKey)
                if (secret !== null) {
                    await storeSecret(IntegrationType.WORKOS, existing.id, SecretField.WebhookSecret, secret)
                }

                await db().workos_integrations.update({
                    where: { id: existing.id },
                    data: {
                        organization_id: organizationId
                    }
                })
                integrationId = existing.id
                logger.info("Updated WorkOS integration", { integrationId, userId })
            } else {
                const integration = await db().workos_integrations.create({
                    data: {
                        user_id: userId,
                        organization_id: organizationId
                    }
                })

                await storeSecret(IntegrationType.WORKOS, integration.id, SecretField.ApiKey, apiKey)
                if (secret !== null) {
                    await storeSecret(IntegrationType.WORKOS, integration.id, SecretField.WebhookSecret, secret)
                }

                integrationId = integration.id
                logger.info("Created WorkOS integration", { integrationId, userId })
            }

            return {
                success: true,
                statusCode: 200,
                data: {
                    integrationId,
                    webhookUrl: `${urls.backend}/webhooks/workos-trigger/${integrationId}`
                }
            }
        } catch (error) {
            logger.error("Error processing WorkOS form submission", { error })
            return {
                success: false,
                error: "Failed to process integration",
                statusCode: 500
            }
        }
    }

    async getSampleEvents(
        integrationId: string,
        organizationId: string,
        _userId: string,
        triggerConfig: ConfigInstance,
        options?: {
            limit?: number
        }
    ): Promise<InputEvent[]> {
        if (triggerConfig.configType !== ConfigType.WORKOS_INPUT) {
            return []
        }
        const workosConfig = triggerConfig as WorkOSInputConfig

        const limit = Math.min(options?.limit ?? 5, 10)
        const workosIntegration = await db().workos_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId }
        })

        const apiKey = workosIntegration ? await getSecret(IntegrationType.WORKOS, workosIntegration.id, SecretField.ApiKey) : null
        if (!apiKey) {
            throw new Error(`WorkOS API key not found for integration ${integrationId}`)
        }

        const events = await fetchWorkOSEvents(apiKey, workosConfig.eventTypes, limit)
        const enrichedEvents = await Promise.all(events.map(event => enrichWorkOSEventPayload(event, apiKey)))

        return enrichedEvents.map(evt => new WorkOSEvent(evt, integrationId))
    }
}

// MARK: - WorkOS Helpers

function parseWorkOSEnvironment(apiKey: string): "live" | "test" {
    if (apiKey.startsWith("sk_live_")) return "live"
    if (apiKey.startsWith("sk_test_")) return "test"
    return "live"
}

// MARK: - WorkOS Events API

interface WorkOSEventsResponse {
    data: WorkOSWebhookPayload[]
    list_metadata: {
        after: string | null
        before: string | null
    }
}

async function fetchWorkOSEvents(apiKey: string, eventTypes: string[], limit: number): Promise<WorkOSWebhookPayload[]> {
    const params = new URLSearchParams({
        limit: String(limit),
        order: "desc"
    })
    for (const eventType of eventTypes) {
        params.append("events", eventType)
    }

    const response = await fetch(`https://api.workos.com/events?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    })

    if (!response.ok) {
        const errorText = await response.text()
        logger.error("Failed to fetch WorkOS events", { status: response.status, error: errorText })
        throw new Error(`WorkOS events API returned ${response.status}`)
    }

    const json = (await response.json()) as WorkOSEventsResponse
    return json.data
}

// WorkOS webhook event payload
export interface WorkOSWebhookPayload {
    id: string
    event: string
    data: Record<string, any>
    created_at: string
}

// Combined type for processWebhookEvent (single parameter per interface contract)
export interface WorkOSWebhookRequest {
    integrationId: string
    payload: WorkOSWebhookPayload
}

export class WorkOSEvent extends InputEvent implements Identifiable {
    readonly integrationType: IntegrationType = IntegrationType.WORKOS
    readonly eventType: WorkOSEventType
    entityType = HydratorType.WORKOS_EVENT
    entityId: string
    data: WorkOSWebhookPayload

    constructor(
        payload: WorkOSWebhookPayload,
        private integrationId: string
    ) {
        super()
        this.data = payload
        this.eventType = payload.event as WorkOSEventType
        this.entityId = `${integrationId}:${payload.id}`
    }

    formatForAgentRunner(): string {
        const eventType = this.data.event
        const data = this.data.data
        const parts = [`WorkOS Event: ${eventType}`]

        if (data.email) {
            parts.push(`User Email: ${data.email}`)
        }
        if (data.first_name || data.last_name) {
            parts.push(`User Name: ${[data.first_name, data.last_name].filter(Boolean).join(" ")}`)
        }
        if (data.id) {
            parts.push(`User ID: ${data.id}`)
        }

        parts.push(`\nFull Event Data:\n${JSON.stringify(data, null, 2)}`)
        return parts.join("\n")
    }

    debugLog(): string {
        return `WorkOS ${this.data.event} (integration: ${this.integrationId})`
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.WORKOS_INPUT) {
            return false
        }
        if (agentTrigger.integration_id !== this.integrationId) {
            return false
        }
        const config = agentTrigger.workos_config
        if (!config || !config.event_types || config.event_types.length === 0) {
            return false
        }
        return config.event_types.includes(this.data.event)
    }

    serializeMetadata(): Record<string, unknown> {
        const d = this.data.data
        const eventType = this.data.event
        const user = extractWorkOSUserFromPayload(d, eventType)
        const meta: Record<string, unknown> = {
            eventId: this.data.id,
            createdAt: this.data.created_at
        }

        if (eventType.startsWith("user.") && user) {
            meta.user = user
        } else if (eventType.startsWith("organization_membership.")) {
            meta.membership = {
                id: d.id,
                userId: d.user_id,
                organizationId: d.organization_id,
                role: d.role,
                status: d.status
            }
        } else if (eventType === "invitation.accepted" || eventType === "invitation.created" || eventType === "invitation.resent" || eventType === "invitation.revoked") {
            meta.invitation = {
                id: d.id,
                email: d.email,
                organizationId: d.organization_id,
                inviterEmail: d.inviter_email,
                state: d.state,
                acceptedAt: d.accepted_at
            }
            if (user) {
                meta.user = user
            }
        } else if (eventType === "organization.created") {
            meta.organization = {
                id: d.id,
                name: d.name
            }
        }

        return meta
    }

    createTriggerMetadata(): RunHistoryTrigger {
        const eventType = this.data.event
        const data = this.data.data
        const userEmail = data.email || data.user?.email
        const userName = [data.first_name, data.last_name].filter(Boolean).join(" ") || userEmail || "Unknown"

        return {
            event: eventType,
            integration: IntegrationType.WORKOS,
            source: "WorkOS",
            title: eventType.replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            subheader: userName
        }
    }
}

function getNestedRecord(value: unknown): Record<string, any> | null {
    return value && typeof value === "object" ? (value as Record<string, any>) : null
}

function getString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined
}

function getWorkOSUserIdFromPayload(data: Record<string, any>, eventType: string): string | undefined {
    return getString(data.user_id) || getString(data.userId) || getString(getNestedRecord(data.user)?.id) || (eventType.startsWith("user.") ? getString(data.id) : undefined)
}

function extractWorkOSUserFromPayload(data: Record<string, any>, eventType: string) {
    const nestedUser = getNestedRecord(data.user)
    const id = getWorkOSUserIdFromPayload(data, eventType)
    const email = getString(data.email) || getString(nestedUser?.email)

    if (!id || !email) {
        return null
    }

    return {
        id,
        email,
        firstName: getString(data.first_name) || getString(data.firstName) || getString(nestedUser?.first_name) || getString(nestedUser?.firstName),
        lastName: getString(data.last_name) || getString(data.lastName) || getString(nestedUser?.last_name) || getString(nestedUser?.lastName),
        emailVerified: Boolean(data.email_verified ?? data.emailVerified ?? nestedUser?.email_verified ?? nestedUser?.emailVerified),
        profilePictureUrl: getString(data.profile_picture_url) || getString(data.profilePictureUrl) || getString(nestedUser?.profile_picture_url) || getString(nestedUser?.profilePictureUrl)
    }
}

function mergeWorkOSUserIntoPayload(payload: WorkOSWebhookPayload, workosUser: WorkOSUserResponse): WorkOSWebhookPayload {
    return {
        ...payload,
        data: {
            ...payload.data,
            email: workosUser.email,
            first_name: workosUser.first_name,
            last_name: workosUser.last_name,
            email_verified: workosUser.email_verified,
            profile_picture_url: workosUser.profile_picture_url,
            user: {
                ...(getNestedRecord(payload.data.user) || {}),
                id: workosUser.id,
                email: workosUser.email,
                first_name: workosUser.first_name,
                last_name: workosUser.last_name,
                email_verified: workosUser.email_verified,
                profile_picture_url: workosUser.profile_picture_url
            }
        }
    }
}

export async function enrichWorkOSEventPayload(payload: WorkOSWebhookPayload, apiKey: string): Promise<WorkOSWebhookPayload> {
    const userId = getWorkOSUserIdFromPayload(payload.data, payload.event)
    if (!userId) {
        return payload
    }

    try {
        const workosUser = await getWorkOSUser(apiKey, userId)
        return mergeWorkOSUserIntoPayload(payload, workosUser)
    } catch (error) {
        logger.warn("Failed to enrich WorkOS event payload with user data", {
            eventId: payload.id,
            eventType: payload.event,
            userId,
            error
        })
        return payload
    }
}

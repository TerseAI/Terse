import { InputConfigType } from "@prisma/client"
import type { User as WorkOSSdkUser } from "@workos-inc/node"
import { WorkOSTrigger, WorkOSWebhookPayload } from "terse-types"
import { FormFieldDefinition, FormIntegrationSetup } from "terse-types"
import { ConfigData, ConfigType, WorkOSEventType, WorkOSInputConfigSchema } from "terse-types/Configs"
import { IntegrationType, WorkOSIntegration, WorkOSIntegrationMetadata } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { urls } from "../config/settings"
import logger from "../logger"
import { getWorkOSUser } from "../outputs/workos/workosApiClient"
import { db } from "../prismaClient"
import { Identifiable } from "../rag/Hydrator"
import { createSecrets, deleteSecrets, getSecrets, tryGetSecrets } from "../services/SecretService"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { getUserForOrg } from "../utility/workos"

import { FormIntegrationInstallation, FormSubmissionInput, FormSubmissionResult, Integration, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "./abstract/Integration"
import { TriggerRuntime } from "./abstract/TriggerRuntime"

export const WORKOS_SUPPORTED_EVENT_NAMES = Object.values(WorkOSEventType) as [WorkOSEventType, ...WorkOSEventType[]]

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
                const secrets = await tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.WORKOS, recordId: i.id } })
                return this.enrichInstance(i.id, secrets?.apiKey ?? "")
            })
        )
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const integrations = await this.getInstancesForOrganization(organizationId)
        const [integration] = integrations

        if (!integration) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Environment", integration.environment, integration.id)
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
                const secrets = await tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.WORKOS, recordId: i.id } })
                return this.enrichInstance(i.id, secrets?.apiKey ?? "")
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

        const secrets = await getSecrets({ type: "integration", secret: { integrationType: IntegrationType.WORKOS, recordId: integrationId } })
        const enrichedPayload = await enrichWorkOSEventPayload(payload, secrets.apiKey)
        const event = new WorkOSTriggerRuntime(enrichedPayload, integrationId)
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

        await deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.WORKOS, recordId: integrationId } })
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
                hint: "After you save, use the webhook URL Terse returns to create an endpoint in WorkOS, then paste the signing secret here (or update later). Webhooks are rejected until this is set."
            }
        ]
    }

    getFormSetup(): FormIntegrationSetup {
        return {
            title: "Get WorkOS Credentials",
            url: "https://workos.com/docs/reference/api-authentication",
            instructions: [
                "Use the API key for the correct WorkOS environment.",
                "Save once to get your Terse webhook URL, create that endpoint in WorkOS, then add the signing secret — deliveries are rejected until the secret is stored.",
                "Webhook setup reference: https://workos.com/docs/events/data-syncing/webhooks"
            ]
        }
    }

    async processFormSubmission(input: FormSubmissionInput): Promise<FormSubmissionResult> {
        const { userId, organizationId, formValues } = input
        const { apiKey, webhookSecret } = formValues

        if (!apiKey || typeof apiKey !== "string") {
            return { success: false, error: "API key is required", statusCode: 400 }
        }

        const secret = typeof webhookSecret === "string" && webhookSecret.trim().length > 0 ? webhookSecret.trim() : null

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
                const storedSecrets = await tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.WORKOS, recordId: existing.id } })
                if (!storedSecrets?.webhookSecret && !secret) {
                    return {
                        success: false,
                        error: "Webhook signing secret is required. Configure it in WorkOS and paste it here so deliveries can be verified.",
                        statusCode: 400
                    }
                }

                await createSecrets({
                    type: "integration",
                    secret: {
                        integrationType: IntegrationType.WORKOS,
                        recordId: existing.id,
                        value: secret !== null ? { apiKey: apiKey, webhookSecret: secret } : { apiKey: apiKey }
                    }
                })

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

                await createSecrets({
                    type: "integration",
                    secret: {
                        integrationType: IntegrationType.WORKOS,
                        recordId: integration.id,
                        value: secret !== null ? { apiKey: apiKey, webhookSecret: secret } : { apiKey: apiKey }
                    }
                })

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
        triggerConfig: ConfigData,
        options?: {
            limit?: number
        }
    ): Promise<TriggerRuntime[]> {
        if (triggerConfig.configType !== ConfigType.WORKOS_INPUT) {
            return []
        }
        const workosConfig = WorkOSInputConfigSchema.parse(triggerConfig)

        const limit = Math.min(options?.limit ?? 5, 10)
        const workosIntegration = await db().workos_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId }
        })
        if (!workosIntegration) {
            throw new Error(`WorkOS integration ${integrationId} not found`)
        }

        const secrets = await getSecrets({ type: "integration", secret: { integrationType: IntegrationType.WORKOS, recordId: workosIntegration.id } })
        const apiKey = secrets.apiKey

        const events = await fetchWorkOSEvents(apiKey, workosConfig.eventTypes, limit)
        const enrichedEvents = await Promise.all(events.map(event => enrichWorkOSEventPayload(event, apiKey)))

        return enrichedEvents.map(evt => new WorkOSTriggerRuntime(evt, integrationId))
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

// Combined type for processWebhookEvent (single parameter per interface contract)
interface WorkOSWebhookRequest {
    integrationId: string
    payload: WorkOSWebhookPayload
}

export class WorkOSTriggerRuntime extends TriggerRuntime<WorkOSTrigger> implements Identifiable {
    readonly integrationType = IntegrationType.WORKOS
    readonly entityType = "workos_event"
    entityId: string
    data: WorkOSTrigger

    constructor(
        payload: WorkOSWebhookPayload,
        private integrationId: string
    ) {
        super()
        this.data = buildWorkOSTrigger(payload)
        this.entityId = `${integrationId}:${payload.id}`
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
        return !config.event_types || config.event_types.length === 0 || config.event_types.includes(this.data.eventType)
    }

    createTriggerMetadata(): RunHistoryTrigger {
        const eventType = this.data.eventType
        const userName = getWorkOSMetadataUserName(this.data)

        return {
            event: eventType,
            integration: IntegrationType.WORKOS,
            source: "WorkOS",
            title: eventType.replace(/[._]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            subheader: userName
        }
    }
}

function getWorkOSMetadataUserName(event: WorkOSTrigger): string {
    const user = "user" in event ? event.user : undefined
    if (user) {
        return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Unknown"
    }
    if ("invitation" in event) {
        return event.invitation.email || "Unknown"
    }
    return "Unknown"
}

function buildWorkOSTrigger(payload: WorkOSWebhookPayload): WorkOSTrigger {
    const data = payload.data
    const eventType = payload.event as WorkOSEventType
    const baseEvent = {
        integrationType: IntegrationType.WORKOS as const,
        eventId: payload.id,
        createdAt: payload.created_at
    }
    const user = extractWorkOSUserFromPayload(data, eventType)

    switch (eventType) {
        case WorkOSEventType.USER_CREATED:
        case WorkOSEventType.USER_UPDATED:
        case WorkOSEventType.USER_DELETED:
            return {
                ...baseEvent,
                eventType,
                user: user ?? buildWorkOSUserFromPayload(data, eventType)
            }
        case WorkOSEventType.ORGANIZATION_MEMBERSHIP_CREATED:
        case WorkOSEventType.ORGANIZATION_MEMBERSHIP_UPDATED:
        case WorkOSEventType.ORGANIZATION_MEMBERSHIP_DELETED:
            return {
                ...baseEvent,
                eventType,
                membership: {
                    id: getString(data.id) ?? "",
                    userId: getString(data.user_id) ?? getString(data.userId) ?? "",
                    organizationId: getString(data.organization_id) ?? getString(data.organizationId) ?? "",
                    role: {
                        slug: getString(getNestedRecord(data.role)?.slug) ?? ""
                    },
                    status: getString(data.status) ?? ""
                }
            }
        case WorkOSEventType.INVITATION_CREATED:
        case WorkOSEventType.INVITATION_ACCEPTED:
        case WorkOSEventType.INVITATION_RESENT:
        case WorkOSEventType.INVITATION_REVOKED:
            return {
                ...baseEvent,
                eventType,
                invitation: {
                    id: getString(data.id) ?? "",
                    email: getString(data.email) ?? "",
                    organizationId: getString(data.organization_id) ?? getString(data.organizationId) ?? "",
                    inviterEmail: getString(data.inviter_email) ?? getString(data.inviterEmail),
                    state: getString(data.state) ?? "",
                    acceptedAt: getString(data.accepted_at) ?? getString(data.acceptedAt)
                },
                ...(user ? { user } : {})
            }
        case WorkOSEventType.ORGANIZATION_CREATED:
            return {
                ...baseEvent,
                eventType,
                organization: {
                    id: getString(data.id) ?? "",
                    name: getString(data.name) ?? ""
                }
            }
    }

    throw new Error(`Unsupported WorkOS trigger event: ${eventType}`)
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

function buildWorkOSUserFromPayload(data: Record<string, any>, eventType: string) {
    const nestedUser = getNestedRecord(data.user)

    return {
        id: getWorkOSUserIdFromPayload(data, eventType) ?? "",
        email: getString(data.email) || getString(nestedUser?.email) || "",
        firstName: getString(data.first_name) || getString(data.firstName) || getString(nestedUser?.first_name) || getString(nestedUser?.firstName),
        lastName: getString(data.last_name) || getString(data.lastName) || getString(nestedUser?.last_name) || getString(nestedUser?.lastName),
        emailVerified: Boolean(data.email_verified ?? data.emailVerified ?? nestedUser?.email_verified ?? nestedUser?.emailVerified),
        profilePictureUrl: getString(data.profile_picture_url) || getString(data.profilePictureUrl) || getString(nestedUser?.profile_picture_url) || getString(nestedUser?.profilePictureUrl)
    }
}

function mergeWorkOSUserIntoPayload(payload: WorkOSWebhookPayload, workosUser: WorkOSSdkUser): WorkOSWebhookPayload {
    return {
        ...payload,
        data: {
            ...payload.data,
            email: workosUser.email,
            first_name: workosUser.firstName,
            last_name: workosUser.lastName,
            email_verified: workosUser.emailVerified,
            profile_picture_url: workosUser.profilePictureUrl,
            user: {
                ...(getNestedRecord(payload.data.user) || {}),
                id: workosUser.id,
                email: workosUser.email,
                first_name: workosUser.firstName,
                last_name: workosUser.lastName,
                email_verified: workosUser.emailVerified,
                profile_picture_url: workosUser.profilePictureUrl
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

import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import jwt from "jsonwebtoken"
import { AttioSubscription, AttioTrigger, AttioWebhookEvent, AttioWebhookPayload, ConfigurationFieldDefinition, attioEventTypeSchema } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { AdditionalStateParams, AttioIntegration, AttioIntegrationMetadata, InstallationOptionsFor, IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { AttioObject, OAuthInstallationDetails } from "terse-types/types"
import { z } from "zod"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { attio as attioConfig, jwt as jwtSettings, urls } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { SecretField, deleteSecretsBestEffort, getSecret, storeSecret } from "../services/SecretService"
import { AgentTriggerWithConfigs, PrismaTransaction } from "../types/prisma"
import { buildAttioWebhookUrl } from "../utility/webhookUrl"
import { createOAuthStateToken } from "../utility/oauth"
import { getUserForOrg } from "../utility/workos"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { FetchResourcesOptions } from "./abstract/FetchResourcesOptions"
import { Integration, IntegrationWithResources, OAuthIntegrationInstallation, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "./abstract/Integration"
import { TriggerRuntime } from "./abstract/TriggerRuntime"

const ATTIO_API_BASE = "https://api.attio.com/v2"

export type AttioWebhookRequest = { triggerId: string; payload: AttioWebhookPayload; idempotencyKey: string }

export class AttioIntegrationManager implements Integration<AttioIntegration, never, typeof AttioIntegrationMetadata, AttioObject>, OAuthIntegrationInstallation<IntegrationType.ATTIO> {
    constructor() {}
    integrationType: IntegrationType = IntegrationType.ATTIO

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<AttioIntegration[]> {
        const integrations = await db().attio_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true
            }
        })
        return Promise.all(
            integrations.map(async i => {
                const accessToken = await getSecret(IntegrationType.ATTIO, i.id, SecretField.AccessToken)
                return {
                    id: i.id,
                    workspaceName: accessToken ? await this.fetchWorkspaceName(accessToken) : undefined
                }
            })
        )
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const integrations = await this.getInstancesForOrganization(organizationId)
        const [integration] = integrations

        if (!integration) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Workspace", integration.workspaceName || "Attio Workspace", integration.id)
    }

    async fetchResourcesForOrganization(organizationId: string, query?: string, _options?: FetchResourcesOptions): Promise<IntegrationWithResources<AttioIntegration, AttioObject>[]> {
        const integrations = await this.getInstancesForOrganization(organizationId)
        const normalizedQuery = query?.trim().toLowerCase()
        const matchesQuery = (value: string | undefined | null): boolean => {
            if (!normalizedQuery) return true
            if (!value) return false
            return value.toLowerCase().includes(normalizedQuery)
        }
        return Promise.all(
            integrations.map(async integration => {
                try {
                    const accessToken = await this.getAccessToken(integration.id)
                    if (!accessToken) {
                        logger.warn(`No access token for Attio integration ${integration.id}`, { integrationId: integration.id })
                        return { integration, resources: [] }
                    }

                    const response = await fetch("https://api.attio.com/v2/objects", {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    })
                    if (!response.ok) {
                        logger.warn(`Failed to fetch Attio objects for integration ${integration.id}`, { status: response.status })
                        return { integration, resources: [] }
                    }

                    const data = await response.json()
                    const allObjects: AttioObject[] = (data?.data || []).map((obj: any) => ({
                        api_slug: obj.api_slug,
                        singular_noun: obj.singular_noun,
                        plural_noun: obj.plural_noun
                    }))

                    const objects = normalizedQuery ? allObjects.filter(obj => matchesQuery(obj.api_slug) || matchesQuery(obj.singular_noun) || matchesQuery(obj.plural_noun)) : allObjects

                    return { integration, resources: objects }
                } catch (error) {
                    logger.warn(`Failed to fetch resources for Attio integration ${integration.id}`, { error, integrationId: integration.id })
                    return { integration, resources: [] }
                }
            })
        )
    }

    formatIntegrationInstanceForAgent(instance: AttioIntegration): string {
        const details: string[] = []
        if (instance.workspaceName) {
            details.push(`workspace "${instance.workspaceName}"`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Attio${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<AttioIntegration[]> {
        const integrations = await db().attio_integrations.findMany({
            select: {
                id: true
            }
        })
        return Promise.all(
            integrations.map(async i => {
                const accessToken = await getSecret(IntegrationType.ATTIO, i.id, SecretField.AccessToken)
                return {
                    id: i.id,
                    workspaceName: accessToken ? await this.fetchWorkspaceName(accessToken) : undefined
                }
            })
        )
    }

    async processWebhookEvent(request: AttioWebhookRequest): Promise<void> {
        const { triggerId, payload, idempotencyKey } = request

        const subscribedTrigger = await db().automation_inputs.findFirst({
            where: { id: triggerId, config_type: InputConfigType.ATTIO_INPUT },
            include: { automation: true }
        })
        if (!subscribedTrigger) {
            logger.info("Attio webhook: trigger not found", { triggerId })
            return
        }

        const user = await getUserForOrg(subscribedTrigger.automation.user_id, subscribedTrigger.automation.organization_id)
        if (!user) {
            logger.warn("Attio webhook: user not found", {
                userId: subscribedTrigger.automation.user_id,
                organizationId: subscribedTrigger.automation.organization_id
            })
            return
        }

        for (let i = 0; i < payload.events.length; i++) {
            const event = payload.events[i]
            const perEventId = payload.events.length > 1 ? `${idempotencyKey}-${i}` : idempotencyKey
            const runtime = new AttioTriggerRuntime(event, subscribedTrigger.integration_id, perEventId)
            const processor = new EventProcessor(runtime, user)
            const results = await processor.process()
            for (const result of results) {
                if (result.success) {
                    logger.info("Attio event processed", {
                        integrationId: subscribedTrigger.integration_id,
                        eventType: event.event_type,
                        agentId: result.agentConfig?.id
                    })
                }
            }
        }
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options?: InstallationOptionsFor<IntegrationType.ATTIO>,
        additionalStatePayload?: AdditionalStateParams
    ): Promise<OAuthInstallationDetails> {
        const state = createOAuthStateToken({
            userId,
            organizationId,
            additionalFields: { timestamp: Date.now() },
            additionalStatePayload
        })

        const authUrl = new URL("https://app.attio.com/authorize")
        authUrl.searchParams.append("client_id", attioConfig.clientId)
        authUrl.searchParams.append("response_type", "code")
        authUrl.searchParams.append("redirect_uri", attioConfig.redirectUri)
        authUrl.searchParams.append("state", state)

        return {
            oauthUrl: authUrl.toString()
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query

        if (error) {
            logger.error("Attio OAuth error", { error: String(error) })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        if (!code || !state) {
            res.status(400).json({ error: "Missing code or state parameter" })
            return
        }

        try {
            const decoded = jwt.verify(state as string, jwtSettings.secret) as {
                userId: string
                organizationId: string
                timestamp: number
                chatId?: string
                channel?: string
                integrationType?: string
            }

            if (!decoded.organizationId || typeof decoded.organizationId !== "string") {
                logger.error("Attio OAuth: organizationId is required in state", {
                    userId: decoded.userId
                })
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Exchange authorization code for access token
            const tokenResponse = await fetch("https://app.attio.com/oauth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: code as string,
                    redirect_uri: attioConfig.redirectUri,
                    client_id: attioConfig.clientId,
                    client_secret: attioConfig.clientSecret
                }).toString()
            })

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text()
                logger.error("Attio token exchange failed", { error: errorText })
                throw new Error(`Attio token exchange failed: ${errorText}`)
            }

            const tokenData = await tokenResponse.json()
            const { access_token } = tokenData

            logger.info("Received Attio access token for user", {
                userId: decoded.userId
            })

            // Check if a connection for this organization already exists
            const existing = await db().attio_integrations.findFirst({
                where: {
                    organization_id: decoded.organizationId
                }
            })

            let integrationId: string
            if (!existing) {
                const newIntegration = await db().attio_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        organization_id: decoded.organizationId
                    }
                })

                await storeSecret(IntegrationType.ATTIO, newIntegration.id, SecretField.AccessToken, access_token)

                integrationId = newIntegration.id
            } else {
                await storeSecret(IntegrationType.ATTIO, existing.id, SecretField.AccessToken, access_token)

                await db().attio_integrations.update({
                    where: { id: existing.id },
                    data: {
                        organization_id: decoded.organizationId
                    }
                })
                integrationId = existing.id
                logger.info("Updated Attio connection token", {
                    integrationId: existing.id,
                    userId: decoded.userId
                })
            }

            logger.info("Attio OAuth completed for user", {
                userId: decoded.userId
            })

            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.ATTIO, integrationId, decoded.userId, decoded, new Date()))

            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("Error in Attio OAuth callback", { error })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return db()
            .$transaction(async tx => {
                await tx.attio_integrations.delete({ where: { id: integrationId } })
            })
            .then(async () => {
                await deleteSecretsBestEffort([{ integrationType: IntegrationType.ATTIO, recordId: integrationId, field: SecretField.AccessToken }])
            })
    }

    async setupAgentTrigger(_integrationId: string, _automationInput: AgentTriggerWithConfigs): Promise<void> {
        // Webhook is created during AttioTrigger.addTriggerToAgent (inside the trigger transaction).
    }

    async teardownAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {
        if (automationInput.config_type !== InputConfigType.ATTIO_INPUT) return
        const webhookId = automationInput.attio_input_config?.webhook_id
        if (!webhookId) return

        logger.info("Attio teardown: deleting webhook", { webhookId, integrationId, triggerId: automationInput.id })
        try {
            await deleteAttioWebhook(webhookId, integrationId)
        } catch (error) {
            logger.error("Attio teardown: failed to delete webhook", { error, webhookId, integrationId })
        }

        await deleteSecretsBestEffort([{ integrationType: IntegrationType.ATTIO, recordId: automationInput.id, field: SecretField.WebhookSecret }])
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        // Attio OAuth doesn't use refresh tokens
        return false
    }

    private async fetchWorkspaceName(accessToken: string): Promise<string | undefined> {
        try {
            const response = await fetch("https://api.attio.com/v2/self", {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            if (response.ok) {
                const data = await response.json()
                return data?.workspace_name || undefined
            }
        } catch (error) {
            logger.warn("Failed to fetch Attio workspace info", { error })
        }
        return undefined
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().attio_integrations.findUnique({
                where: { id: integrationId },
                select: {
                    id: true
                }
            })

            if (!integration) {
                logger.error(`Attio integration ${integrationId} not found`, { integrationId })
                return null
            }

            return await getSecret(IntegrationType.ATTIO, integrationId, SecretField.AccessToken)
        } catch (error) {
            logger.error(`Error getting Attio access token for integration ${integrationId}`, { error, integrationId })
            return null
        }
    }
}

export class AttioTriggerRuntime extends TriggerRuntime<AttioTrigger> {
    readonly integrationType = IntegrationType.ATTIO
    data: AttioTrigger
    private integrationId: string

    constructor(event: AttioWebhookEvent, integrationId: string, eventId: string) {
        super()
        this.data = buildAttioTrigger(event, eventId)
        this.integrationId = integrationId
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.ATTIO_INPUT) return false
        if (agentTrigger.integration_id !== this.integrationId) return false
        // Attio filters via subscriptions server-side: any event we receive is one we subscribed to.
        return true
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: this.data.eventType,
            integration: IntegrationType.ATTIO,
            source: "Attio",
            title: humanizeAttioEventType(this.data.eventType),
            subheader: this.data.resourceIds.record_id ?? this.data.resourceIds.entry_id ?? this.data.resourceIds.note_id ?? this.data.resourceIds.task_id ?? this.data.resourceIds.comment_id ?? this.data.workspaceId
        }
    }
}

const attioCreateWebhookResponseSchema = z.object({
    data: z.object({
        id: z.object({
            workspace_id: z.string(),
            webhook_id: z.string()
        }),
        secret: z.string()
    })
})

export async function createAttioWebhook(tx: PrismaTransaction, triggerId: string, integrationId: string, subscriptions: AttioSubscription[]): Promise<string> {
    if (subscriptions.length === 0) {
        throw new Error("Attio webhook requires at least one subscription")
    }

    const attioRow = await tx.attio_integrations.findUnique({ where: { id: integrationId } })
    if (!attioRow) {
        throw new Error("Attio integration not found")
    }

    const accessToken = await getSecret(IntegrationType.ATTIO, integrationId, SecretField.AccessToken)
    if (!accessToken) {
        throw new Error("Attio access token not found")
    }

    const requestBody = {
        data: {
            target_url: buildAttioWebhookUrl(triggerId),
            subscriptions: subscriptions.map(sub => ({ event_type: sub.eventType, filter: null }))
        }
    }

    const response = await fetch(`${ATTIO_API_BASE}/webhooks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    })

    const raw = await response.json()
    if (!response.ok) {
        logger.error("Attio CreateWebhook failed", { status: response.status, body: raw, triggerId })
        throw new Error(`Attio rejected webhook: ${JSON.stringify(raw)}`)
    }

    const parsed = attioCreateWebhookResponseSchema.parse(raw)
    const webhookId = parsed.data.id.webhook_id

    await storeSecret(IntegrationType.ATTIO, triggerId, SecretField.WebhookSecret, parsed.data.secret)

    logger.info("Attio CreateWebhook succeeded", { webhookId, triggerId })
    return webhookId
}

const attioGetWebhookResponseSchema = z.object({
    data: z.object({
        subscriptions: z.array(
            z.object({
                event_type: attioEventTypeSchema
            })
        )
    })
})

export async function fetchAttioWebhookSubscriptions(integrationId: string, webhookId: string): Promise<AttioSubscription[]> {
    const accessToken = await getSecret(IntegrationType.ATTIO, integrationId, SecretField.AccessToken)
    if (!accessToken) {
        throw new Error("Attio access token not found")
    }

    const response = await fetch(`${ATTIO_API_BASE}/webhooks/${encodeURIComponent(webhookId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Attio GetWebhook failed: ${response.status} ${text}`)
    }

    const parsed = attioGetWebhookResponseSchema.parse(await response.json())
    return parsed.data.subscriptions.map(s => ({ eventType: s.event_type }))
}

async function deleteAttioWebhook(webhookId: string, integrationId: string): Promise<void> {
    const accessToken = await getSecret(IntegrationType.ATTIO, integrationId, SecretField.AccessToken)
    if (!accessToken) {
        throw new Error("Attio access token not found")
    }

    const response = await fetch(`${ATTIO_API_BASE}/webhooks/${encodeURIComponent(webhookId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!response.ok && response.status !== 404) {
        const text = await response.text()
        logger.error("Attio DeleteWebhook failed", { status: response.status, body: text, webhookId })
        throw new Error(`Failed to delete Attio webhook: ${text}`)
    }

    logger.info("Attio DeleteWebhook succeeded", { webhookId })
}

function buildAttioTrigger(event: AttioWebhookEvent, eventId: string): AttioTrigger {
    return {
        integrationType: IntegrationType.ATTIO,
        eventType: event.event_type,
        eventId,
        createdAt: new Date().toISOString(),
        workspaceId: event.id.workspace_id,
        resourceIds: event.id,
        actor: event.actor,
        rawEvent: event as unknown as Record<string, unknown>
    } as AttioTrigger
}

function humanizeAttioEventType(eventType: string): string {
    return eventType
        .replace(/[-.]/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
}

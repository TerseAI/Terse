import { LinearClient } from "@linear/sdk"
import type { IssueFilter, IssuesQueryVariables, PaginationOrderBy } from "@linear/sdk/dist/_generated_documents"
import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import { LinearTrigger, LinearWebhookPayload } from "terse-types"
import { ConfigurationFieldDefinition } from "terse-types"
import { ConfigData, ConfigType } from "terse-types/Configs"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { AdditionalStateParams, InstallationOptionsFor, IntegrationType, LinearIntegration, LinearIntegrationMetadata } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { LinearTeam, OAuthInstallationDetails } from "terse-types/types"
import { z } from "zod"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { OAUTH_TOKEN_REFRESH_THRESHOLD_MS, settings, urls } from "../config/settings"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { Identifiable } from "../rag/Hydrator"
import { fetchLinearTeams } from "../routes/linear"
import { StoredFile } from "../services/FileStorageService"
import { SecretNotFoundError } from "../services/SecretService"
import { LinearAdapter } from "../ticketing/linear"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { mintBrowserOAuthState, verifyOAuthState } from "../utility/oauth"
import { getUserForOrg } from "../utility/workos"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { FetchResourcesOptions } from "./abstract/FetchResourcesOptions"
import { Integration, IntegrationWithResources, OAuthIntegrationInstallation, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "./abstract/Integration"
import { TriggerRuntime } from "./abstract/TriggerRuntime"

export class LinearIntegrationManager
    extends Integration<LinearIntegration, LinearWebhookPayload, typeof LinearIntegrationMetadata, LinearTeam>
    implements OAuthIntegrationInstallation<IntegrationType.LINEAR>
{
    readonly integrationType = IntegrationType.LINEAR
    readonly secretSchema = z.object({
        accessToken: z.string(),
        refreshToken: z.string()
    })

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<LinearIntegration[]> {
        const linearIntegrations = await db().linear_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true
            }
        })
        return linearIntegrations.map(li => ({
            id: li.id,
            workspaceName: li.workspace_name
        }))
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const integration = await db().linear_integrations.findFirst({
            where: { organization_id: organizationId },
            orderBy: { created_at: "asc" }
        })

        if (!integration) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Workspace", integration.workspace_name, integration.id)
    }

    async fetchResourcesForOrganization(organizationId: string, query?: string, _options?: FetchResourcesOptions): Promise<IntegrationWithResources<LinearIntegration, LinearTeam>[]> {
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
                    const response = await fetchLinearTeams(organizationId, integration.id)
                    const teams = normalizedQuery ? response.filter(team => matchesQuery(team.name) || matchesQuery(team.key)) : response
                    return { integration, resources: teams }
                } catch (error) {
                    logger.warn(`Failed to fetch resources for Linear integration ${integration.id}`, { error, integrationId: integration.id })
                    return { integration, resources: [] }
                }
            })
        )
    }

    formatIntegrationInstanceForAgent(instance: LinearIntegration): string {
        const details: string[] = []
        if (instance.workspaceName) {
            details.push(`workspace "${instance.workspaceName}"`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Linear${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<LinearIntegration[]> {
        const integrations = await db().linear_integrations.findMany({
            select: {
                id: true,
                workspace_id: true,
                workspace_name: true
            }
        })
        return integrations.map(li => ({
            id: li.id,
            workspaceName: li.workspace_name
        }))
    }

    async processWebhookEvent(event: LinearWebhookPayload): Promise<void> {
        logger.info("📥 [LINEAR INTEGRATION MANAGER] Received webhook event", {
            type: event.type,
            action: event.action,
            organizationId: event.organizationId
        })

        const workspaceIdentifier = event.organizationId

        if (!workspaceIdentifier) {
            logger.warn("⚠️  [LINEAR INTEGRATION MANAGER] No workspace identifier found in webhook payload", { eventType: event.type, action: event.action })
            return
        }

        const matchingIntegrations = await db().linear_integrations.findMany({
            where: {
                workspace_id: workspaceIdentifier
            },
            include: {
                user: true
            }
        })

        if (matchingIntegrations.length === 0) {
            logger.warn(`⚠️  [LINEAR INTEGRATION MANAGER] No integrations found for workspace: ${workspaceIdentifier}`, { workspaceIdentifier, eventType: event.type })
            return
        }

        logger.info(`✅ [LINEAR INTEGRATION MANAGER] Found ${matchingIntegrations.length} matching integration(s)`, { count: matchingIntegrations.length, workspaceIdentifier })

        // Process event for each matching integration
        for (const integration of matchingIntegrations) {
            const user = await getUserForOrg(integration.user_id, integration.organization_id)
            if (!user) {
                continue
            }
            try {
                await runWithUserContext(user, async () => {
                    const linearEvent = new LinearTriggerRuntime(event, integration.id)
                    const eventProcessor = new EventProcessor(linearEvent, user)
                    await eventProcessor.process()
                })
            } catch (error) {
                logger.error(`❌ [LINEAR INTEGRATION MANAGER] Error processing event for integration ${integration.id}`, {
                    error,
                    integrationId: integration.id,
                    eventType: event.type,
                    action: event.action
                })
                // Continue processing other integrations even if one fails
            }
        }
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options: InstallationOptionsFor<IntegrationType.LINEAR> | undefined,
        additionalStatePayload: AdditionalStateParams | undefined,
        res: Response
    ): Promise<OAuthInstallationDetails> {
        // Bind state to a single-use cookie nonce.
        const state = mintBrowserOAuthState(res, {
            userId,
            organizationId,
            additionalFields: { timestamp: Date.now() },
            additionalStatePayload
        })

        const clientId = settings.linear.clientId
        const redirectUri = settings.linear.oauthCallbackUrl

        // Build OAuth URL with proper encoding
        const authUrl = new URL("https://linear.app/oauth/authorize")
        authUrl.searchParams.append("client_id", clientId)
        authUrl.searchParams.append("redirect_uri", redirectUri)
        authUrl.searchParams.append("response_type", "code")
        authUrl.searchParams.append("scope", "read,write,issues:create")
        authUrl.searchParams.append("state", state)
        authUrl.searchParams.append("actor", "user")
        authUrl.searchParams.append("prompt", "consent")

        return {
            oauthUrl: authUrl.toString()
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query

        if (error) {
            logger.error("Linear OAuth error", { error: String(error) })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
            return
        }

        if (!code || !state) {
            res.status(400).json({ error: "Missing code or state parameter" })
            return
        }

        try {
            // Verify state — throws if signature/expiry bad, or if browser
            // flow's cookie nonce does not match.
            const decoded = verifyOAuthState(req, res, state as string) as {
                userId: string
                organizationId: string
                timestamp: number
            }

            if (!decoded.organizationId || typeof decoded.organizationId !== "string") {
                logger.error("Linear OAuth: organizationId is required in state", {
                    userId: decoded.userId
                })
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Exchange authorization code for access token
            const params = new URLSearchParams()
            params.append("code", code as string)
            params.append("redirect_uri", settings.linear.oauthCallbackUrl)
            params.append("client_id", settings.linear.clientId)
            params.append("client_secret", settings.linear.clientSecret)
            params.append("grant_type", "authorization_code")

            const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: params.toString()
            })

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text()
                logger.error("Linear token exchange failed", { error: errorText })
                throw new Error(`Linear token exchange failed: ${errorText}`)
            }

            const tokenData = await tokenResponse.json()
            const { access_token, refresh_token, expires_in } = tokenData

            if (!access_token) {
                throw new Error("No access token received from Linear")
            }

            // Calculate token expiry if expires_in is provided
            const tokenExpiry = new Date(Date.now() + expires_in * 1000)

            logger.info("🔑 Received Linear access token for user", {
                userId: decoded.userId
            })

            // Use the access token to get user and workspace info
            const adapter = new LinearAdapter(access_token)
            const userContext = await adapter.getUserContext()
            const linearUser = userContext.userInfo
            const linearOrganization = userContext.organization

            logger.info("🏢 Workspace", {
                workspaceName: linearOrganization.name,
                userId: decoded.userId
            })

            // Check if a connection for this workspace already exists
            const existing = await db().linear_integrations.findFirst({
                where: {
                    organization_id: decoded.organizationId,
                    workspace_id: linearOrganization.id
                }
            })

            let integrationId: string
            if (!existing) {
                const newIntegration = await db().linear_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        organization_id: decoded.organizationId,
                        linear_user_id: linearUser.id,
                        workspace_id: linearOrganization.id,
                        workspace_name: linearOrganization.name,
                        token_expiry: tokenExpiry
                    }
                })

                await this.secretService.createSecrets({
                    type: "integration",
                    secret: {
                        integrationType: IntegrationType.LINEAR,
                        recordId: newIntegration.id,
                        value: refresh_token ? { accessToken: access_token, refreshToken: refresh_token } : { accessToken: access_token }
                    }
                })

                integrationId = newIntegration.id
                logger.info("✅ Created Linear OAuth connection", {
                    workspaceName: linearOrganization.name,
                    userId: decoded.userId
                })
            } else {
                await this.secretService.createSecrets({
                    type: "integration",
                    secret: {
                        integrationType: IntegrationType.LINEAR,
                        recordId: existing.id,
                        value: refresh_token ? { accessToken: access_token, refreshToken: refresh_token } : { accessToken: access_token }
                    }
                })

                // Update existing connection with new token (in case it was revoked and re-authorized)
                await db().linear_integrations.update({
                    where: { id: existing.id },
                    data: {
                        token_expiry: tokenExpiry
                    }
                })
                integrationId = existing.id
                logger.info("✅ Updated Linear OAuth connection token", {
                    workspaceName: linearOrganization.name,
                    integrationId: existing.id,
                    userId: decoded.userId
                })
            }

            logger.info("✅ Linear OAuth completed for user", {
                userId: decoded.userId,
                workspaceName: linearOrganization.name
            })

            // Emit integration completed task (includes full state payload for chat metadata detection)
            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.LINEAR, integrationId, decoded.userId, decoded, new Date()))

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("Error in Linear OAuth callback", { error })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return db()
            .$transaction(async tx => {
                await tx.linear_integrations.delete({ where: { id: integrationId } })
            })
            .then(async () => {
                await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.LINEAR, recordId: integrationId } })
            })
    }

    async setupAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Linear doesn't require any setup for channel inputs
        // Webhooks are managed at the integration level
    }

    async teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // Linear doesn't require any teardown for channel inputs
        // Webhooks are managed at the integration level
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        try {
            const integration = await db().linear_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration) {
                logger.warn(`Linear integration ${integrationId} not found`, {
                    integrationId
                })
                return false
            }

            // Store the original token expiry to detect if refresh happened
            const originalTokenExpiry = integration.token_expiry

            // Use getAccessToken which internally handles token refresh
            const accessToken = await this.getAccessToken(integrationId)
            if (!accessToken) {
                // Check if token was actually refreshed by comparing expiry dates
                const updatedIntegration = await db().linear_integrations.findUnique({
                    where: { id: integrationId },
                    select: { token_expiry: true }
                })

                if (!updatedIntegration || !originalTokenExpiry || !updatedIntegration.token_expiry) {
                    return false
                }

                // If expiry changed, token was refreshed
                return updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime()
            }

            // Check if token was refreshed by comparing expiry dates
            const updatedIntegration = await db().linear_integrations.findUnique({
                where: { id: integrationId },
                select: { token_expiry: true }
            })

            if (!updatedIntegration || !originalTokenExpiry || !updatedIntegration.token_expiry) {
                return false
            }

            // Token was refreshed if expiry changed
            return updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime()
        } catch (error) {
            logger.error(`Error refreshing Linear token for integration ${integrationId}`, { error, integrationId })
            return false
        }
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().linear_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration) {
                logger.error(`Linear integration ${integrationId} not found`, {
                    integrationId
                })
                return null
            }
            const secrets = await this.secretService.getSecrets({
                type: "integration",
                secret: { integrationType: IntegrationType.LINEAR, recordId: integration.id }
            })
            const { accessToken: existingAccessToken, refreshToken } = secrets

            const now = new Date()
            // Check if token is expired or will expire within the refresh threshold
            if (integration.token_expiry && integration.token_expiry <= new Date(now.getTime() + OAUTH_TOKEN_REFRESH_THRESHOLD_MS)) {
                logger.info(`Linear access token expiring soon for integration ${integrationId}, refreshing...`, { integrationId })

                if (!refreshToken) {
                    logger.error(`No refresh token available for Linear integration ${integrationId}`, { integrationId })
                    return existingAccessToken // Return existing token as fallback
                }

                // Exchange refresh token for new access token
                const params = new URLSearchParams()
                params.append("refreshToken", refreshToken)
                params.append("client_id", settings.linear.clientId)
                params.append("client_secret", settings.linear.clientSecret)
                params.append("grant_type", "refreshToken")

                const tokenResponse = await fetch("https://api.linear.app/oauth/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: params.toString()
                })

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text()
                    logger.error(`Linear token refresh failed for integration ${integrationId}`, { error: errorText, integrationId })
                    // Return existing token as fallback - it might still work
                    return existingAccessToken
                }

                const tokenData = await tokenResponse.json()
                const { access_token, refresh_token, expires_in } = tokenData

                if (!access_token) {
                    logger.error(`No access token received from Linear refresh for integration ${integrationId}`, { integrationId })
                    // Return existing token as fallback
                    return existingAccessToken
                }

                // Calculate token expiry
                const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000)

                await this.secretService.createSecrets({
                    type: "integration",
                    secret: {
                        integrationType: IntegrationType.LINEAR,
                        recordId: integration.id,
                        value: refresh_token ? { accessToken: access_token, refreshToken: refresh_token } : { accessToken: access_token }
                    }
                })

                // Update the database with new tokens
                await db().linear_integrations.update({
                    where: { id: integration.id },
                    data: {
                        token_expiry: tokenExpiry
                    }
                })

                logger.info(`Successfully refreshed Linear access token for integration ${integrationId}`, { integrationId })
                return access_token
            }

            // Token is still valid
            return existingAccessToken
        } catch (error) {
            if (error instanceof SecretNotFoundError) {
                logger.error(`Linear integration ${integrationId} not found or missing access token`, { integrationId })
                return null
            }
            throw error
        }
    }

    async getSampleEvents(integrationId: string, organizationId: string, _userId: string, triggerConfig: ConfigData, options?: { limit?: number }): Promise<TriggerRuntime[]> {
        if (triggerConfig.configType !== ConfigType.LINEAR_INPUT) {
            return []
        }

        const limit = Math.min(options?.limit ?? 5, 10)
        const linearIntegration = await db().linear_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId }
        })
        if (!linearIntegration) {
            throw new Error(`Linear integration ${integrationId} not found`)
        }

        const accessToken = await this.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Linear access token not found for integration ${integrationId}. Please reconnect.`)
        }

        const client = new LinearClient({ apiKey: accessToken })

        const teamId = triggerConfig.teamId?.trim() || undefined
        const projectId = triggerConfig.projectId?.trim() || undefined
        const filter: IssueFilter = {}
        if (teamId) {
            filter.team = { id: { eq: teamId } }
        }
        if (projectId) {
            filter.project = { id: { eq: projectId } }
        }
        const hasIssueFilter = Object.keys(filter).length > 0

        const listParams: IssuesQueryVariables = {
            first: limit,
            orderBy: "updatedAt" as PaginationOrderBy,
            ...(hasIssueFilter ? { filter } : {})
        }
        const issuesResponse = await client.issues(listParams)

        const events: TriggerRuntime[] = []
        for (const issue of issuesResponse.nodes) {
            const [team, state, assignee, creator] = await Promise.all([issue.team, issue.state, issue.assignee, issue.creator])

            const payload: LinearWebhookPayload = {
                action: "create",
                actor: {
                    id: creator?.id || "unknown",
                    name: creator?.name || "Unknown",
                    email: creator?.email || "",
                    url: "",
                    type: "user"
                },
                createdAt: issue.createdAt.toISOString(),
                data: {
                    id: issue.id,
                    createdAt: issue.createdAt.toISOString(),
                    updatedAt: issue.updatedAt.toISOString(),
                    number: issue.number,
                    title: issue.title,
                    priority: issue.priority,
                    sortOrder: issue.sortOrder,
                    prioritySortOrder: 0,
                    slaType: "",
                    addedToTeamAt: issue.createdAt.toISOString(),
                    trashed: false,
                    labelIds: [],
                    teamId: team?.id || "",
                    previousIdentifiers: [],
                    stateId: state?.id || "",
                    reactionData: [],
                    priorityLabel: issue.priorityLabel || "",
                    identifier: issue.identifier,
                    url: issue.url,
                    subscriberIds: [],
                    state: {
                        id: state?.id || "",
                        color: state?.color || "",
                        name: state?.name || "",
                        type: state?.type || ""
                    },
                    team: {
                        id: team?.id || "",
                        key: team?.key || "",
                        name: team?.name || ""
                    },
                    labels: [],
                    description: issue.description ?? undefined,
                    assignee: assignee ? { id: assignee.id, name: assignee.name } : undefined,
                    ...(issue.projectId ? { projectId: issue.projectId } : {})
                },
                type: "Issue",
                organizationId: linearIntegration.workspace_id,
                webhookTimestamp: Date.now(),
                webhookId: "sample"
            }
            events.push(new LinearTriggerRuntime(payload, integrationId))
        }
        return events
    }
}

export async function getLinearAccessTokenForOrganization(integrationId: string, organizationId: string): Promise<string> {
    const linearIntegration = await db().linear_integrations.findUnique({
        where: { id: integrationId, organization_id: organizationId }
    })
    if (!linearIntegration) {
        throw new Error(`Linear integration not found for integrationId: ${integrationId}`)
    }

    const manager = new LinearIntegrationManager()
    const accessToken = await manager.getAccessToken(linearIntegration.id)
    if (!accessToken) {
        throw new Error(`Linear integration not found or access denied for integrationId: ${integrationId}`)
    }

    return accessToken
}

/**
 * Verifies that the given Linear team exists and is accessible with the integration's token.
 */
export async function validateLinearTeamExists(integrationId: string, teamId: string): Promise<void> {
    const manager = new LinearIntegrationManager()
    const accessToken = await manager.getAccessToken(integrationId)
    if (!accessToken) {
        throw new Error(`Linear integration ${integrationId} not found or missing access token`)
    }
    const client = new LinearClient({ apiKey: accessToken })
    const team = await client.team(teamId)
    if (!team) {
        throw new Error(`Linear team ${teamId} not found or not accessible`)
    }
}

/**
 * Verifies that the given Linear project exists and is accessible with the integration's token.
 */
export async function validateLinearProjectExists(integrationId: string, projectId: string): Promise<void> {
    const manager = new LinearIntegrationManager()
    const accessToken = await manager.getAccessToken(integrationId)
    if (!accessToken) {
        throw new Error(`Linear integration ${integrationId} not found or missing access token`)
    }
    const client = new LinearClient({ apiKey: accessToken })
    const project = await client.project(projectId)
    if (!project) {
        throw new Error(`Linear project ${projectId} not found or not accessible`)
    }
}

export class LinearTriggerRuntime extends TriggerRuntime<LinearTrigger> implements Identifiable {
    readonly integrationType = IntegrationType.LINEAR
    readonly entityType = "linear_event"
    entityId: string
    data: LinearTrigger
    private integrationId: string

    constructor(data: LinearWebhookPayload, integrationId: string) {
        super()
        this.data = buildLinearTrigger(data)
        this.integrationId = integrationId
        const dataId = (data.data as { id?: string })?.id
        this.entityId = `${integrationId}:${dataId ?? "unknown"}`
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        logger.debug(`Checking if Linear event matches channel input: ${agentTrigger.config_type}`, {
            configType: agentTrigger.config_type,
            eventType: this.data.type,
            action: this.data.action
        })
        // Check if integration type matches
        if (agentTrigger.config_type !== InputConfigType.LINEAR) {
            return false
        }
        if (agentTrigger.integration_id !== this.integrationId) {
            return false
        }
        const linearConfig = agentTrigger.linear_config
        if (!linearConfig || !linearConfig.event_types || linearConfig.event_types.length === 0) {
            return false
        }
        if (!linearConfig.event_types.includes(this.data.eventType)) {
            return false
        }

        // Team/project filters apply to issue payloads only (comment webhooks do not include issue team/project).
        if (this.data.type === "Issue" && this.data.data) {
            const d = this.data.data
            if (linearConfig.team_id) {
                const teamId = d.team?.id ?? d.teamId
                if (teamId !== linearConfig.team_id) {
                    return false
                }
            }
            if (linearConfig.project_id) {
                const issueRecord = d as Record<string, unknown>
                const projectId = typeof issueRecord.projectId === "string" ? issueRecord.projectId : undefined
                if (projectId !== linearConfig.project_id) {
                    return false
                }
            }
        }

        return true
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // Create event name in lowercase snake_case based on event type and action
        const eventTypeSnake = this.data.type.toLowerCase().replace(/\s+/g, "_")
        const actionSnake = this.data.action.toLowerCase()
        const eventName = `${eventTypeSnake}_${actionSnake}`

        // Get URL from the event data
        let url: string | undefined
        let title: string | undefined
        let subheader: string | undefined
        let source: string

        if (this.data.type === "Issue" && this.data.data) {
            url = this.data.data.url
            title = this.data.data.title
            subheader = `${this.data.data.identifier} - ${this.data.data.state?.name || "Unknown"}`
            source = this.data.data.team?.name || this.data.organizationId
        } else if (this.data.type === "Comment" && this.data.data) {
            // Linear webhook payload includes url field at the top level for comments
            url = this.data.url
            title = `Comment on ${this.data.data.issueId || "Unknown Issue"}`
            subheader = this.data.actor.name
            source = this.data.organizationId
        } else {
            // For other event types, try to get URL from data or use a generic format
            const data = this.data.data as any
            url = data?.url || this.data.url
            title = `${this.data.type} ${this.data.action}`
            subheader = this.data.actor.name
            source = this.data.organizationId
        }

        return {
            event: eventName,
            integration: IntegrationType.LINEAR,
            source: source,
            title: title,
            subheader: subheader,
            url: url
        }
    }

    getFiles(): StoredFile[] {
        return []
    }
}

function buildLinearTrigger(data: LinearWebhookPayload): LinearTrigger {
    if (data.type === "Issue" && data.action === "create") {
        return {
            ...data,
            integrationType: IntegrationType.LINEAR,
            eventType: "issue.created",
            action: "create",
            type: "Issue"
        }
    }

    if (data.type === "Issue" && data.action === "update") {
        return {
            ...data,
            integrationType: IntegrationType.LINEAR,
            eventType: "issue.updated",
            action: "update",
            type: "Issue"
        }
    }

    if (data.type === "Comment" && data.action === "create") {
        const commentData = data.data as Record<string, unknown>
        return {
            ...data,
            integrationType: IntegrationType.LINEAR,
            eventType: "comment.created",
            action: "create",
            type: "Comment",
            data: {
                ...commentData,
                id: typeof commentData.id === "string" ? commentData.id : "unknown",
                body: typeof commentData.body === "string" ? commentData.body : undefined,
                issueId: typeof commentData.issueId === "string" ? commentData.issueId : undefined
            }
        }
    }

    throw new Error(`Unsupported Linear trigger event: ${data.type}.${data.action}`)
}

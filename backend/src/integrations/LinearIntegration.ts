import { LinearClient } from "@linear/sdk"
import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import jwt from "jsonwebtoken"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { OAUTH_TOKEN_REFRESH_THRESHOLD_MS, settings, urls } from "../config/settings"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { Identifiable } from "../rag/Hydrator"
import { fetchLinearTeams } from "../routes/linear"
import { StoredFile } from "../services/FileStorageService"
import { ConfigInstance, ConfigType } from "../shared/Configs"
import { FrontendRoutes } from "../shared/FrontendRoutes"
import { AdditionalStateParams, InstallationOptionsFor, IntegrationType, LinearIntegration, LinearIntegrationMetadata } from "../shared/Integrations"
import { RunHistoryTrigger } from "../shared/RunHistoryTypes"
import { LinearTeam, OAuthInstallationDetails } from "../shared/types"
import { LinearAdapter } from "../ticketing/linear"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { HydratorType } from "../types/rag"
import { LinearWebhookPayload } from "../utility/LinearWebhookPayload"
import { createOAuthStateToken } from "../utility/oauth"
import { getUserForOrg } from "../utility/workos"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { FetchResourcesOptions } from "./abstract/FetchResourcesOptions"
import { InputEvent } from "./abstract/InputEvent"
import { ConfigurationFieldDefinition, Integration, IntegrationWithResources, OAuthIntegrationInstallation } from "./abstract/Integration"

export class LinearIntegrationManager
    implements Integration<LinearIntegration, LinearWebhookPayload, typeof LinearIntegrationMetadata, LinearTeam>, OAuthIntegrationInstallation<IntegrationType.LINEAR>
{
    constructor() {}
    integrationType: IntegrationType = IntegrationType.LINEAR

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
        logger.debug("📥 [LINEAR INTEGRATION MANAGER] Received webhook event", {
            type: event.type,
            action: event.action,
            organizationId: event.organizationId
        })

        // Find all integrations that match this event based on workspace_id
        // We match by team name from the webhook payload, which should correspond to workspace_id
        const workspaceIdentifier = event.data?.team?.name || event.organizationId

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
                    const linearEvent = new LinearEvent(event, integration.id)
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
        options?: InstallationOptionsFor<IntegrationType.LINEAR>,
        additionalStatePayload?: AdditionalStateParams
    ): Promise<OAuthInstallationDetails> {
        // Generate state token for security (prevents CSRF)
        const state = createOAuthStateToken({
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
            // Verify state token to prevent CSRF attacks
            const decoded = jwt.verify(state as string, settings.jwt.secret) as {
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
            const organization = userContext.organization

            logger.info("🏢 Workspace", {
                workspaceName: organization.name,
                userId: decoded.userId
            })

            // Check if a connection for this workspace already exists
            const existing = await db().linear_integrations.findFirst({
                where: {
                    organization_id: decoded.organizationId,
                    workspace_id: organization.name
                }
            })

            let integrationId: string
            if (!existing) {
                const newIntegration = await db().linear_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        organization_id: decoded.organizationId,
                        linear_user_id: linearUser.id,
                        workspace_id: organization.name,
                        workspace_name: organization.name,
                        access_token: access_token,
                        refresh_token: refresh_token,
                        token_expiry: tokenExpiry
                    }
                })
                integrationId = newIntegration.id
                logger.info("✅ Created Linear OAuth connection", {
                    workspaceName: organization.name,
                    userId: decoded.userId
                })
            } else {
                // Update existing connection with new token (in case it was revoked and re-authorized)
                await db().linear_integrations.update({
                    where: { id: existing.id },
                    data: {
                        access_token: access_token,
                        refresh_token: refresh_token || existing.refresh_token, // Preserve existing refresh token if new one not provided
                        token_expiry: tokenExpiry
                    }
                })
                integrationId = existing.id
                logger.info("✅ Updated Linear OAuth connection token", {
                    workspaceName: organization.name,
                    integrationId: existing.id,
                    userId: decoded.userId
                })
            }

            logger.info("✅ Linear OAuth completed for user", {
                userId: decoded.userId,
                workspaceName: organization.name
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
        return Promise.resolve()
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

            const now = new Date()
            // Check if token is expired or will expire within the refresh threshold
            if (integration.token_expiry && integration.token_expiry <= new Date(now.getTime() + OAUTH_TOKEN_REFRESH_THRESHOLD_MS)) {
                logger.info(`Linear access token expiring soon for integration ${integrationId}, refreshing...`, { integrationId })

                if (!integration.refresh_token) {
                    logger.error(`No refresh token available for Linear integration ${integrationId}`, { integrationId })
                    return integration.access_token // Return existing token as fallback
                }

                // Exchange refresh token for new access token
                const params = new URLSearchParams()
                params.append("refresh_token", integration.refresh_token)
                params.append("client_id", settings.linear.clientId)
                params.append("client_secret", settings.linear.clientSecret)
                params.append("grant_type", "refresh_token")

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
                    return integration.access_token
                }

                const tokenData = await tokenResponse.json()
                const { access_token, refresh_token, expires_in } = tokenData

                if (!access_token) {
                    logger.error(`No access token received from Linear refresh for integration ${integrationId}`, { integrationId })
                    // Return existing token as fallback
                    return integration.access_token
                }

                // Calculate token expiry
                const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000)

                // Update the database with new tokens
                await db().linear_integrations.update({
                    where: { id: integration.id },
                    data: {
                        access_token: access_token,
                        refresh_token: refresh_token || integration.refresh_token, // Preserve existing if new one not provided
                        token_expiry: tokenExpiry
                    }
                })

                logger.info(`Successfully refreshed Linear access token for integration ${integrationId}`, { integrationId })
                return access_token
            }

            // Token is still valid
            return integration.access_token
        } catch (error) {
            logger.error(`Error getting Linear access token for integration ${integrationId}`, { error, integrationId })
            // Return null on error - caller should handle
            return null
        }
    }

    async getSampleEvents(integrationId: string, organizationId: string, triggerConfig: ConfigInstance, options?: { limit?: number }): Promise<InputEvent[]> {
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
        const issuesResponse = await client.issues({
            first: limit,
            orderBy: "updatedAt" as any
        })

        const events: InputEvent[] = []
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
                    assignee: assignee ? { id: assignee.id, name: assignee.name } : undefined
                },
                type: "Issue",
                organizationId: linearIntegration.workspace_id,
                webhookTimestamp: Date.now(),
                webhookId: "sample"
            }
            events.push(new LinearEvent(payload, integrationId))
        }
        return events
    }
}

// MARK: - LinearEvent

export class LinearEvent extends InputEvent implements Identifiable {
    readonly integrationType: IntegrationType = IntegrationType.LINEAR
    entityType = HydratorType.LINEAR_EVENT
    entityId: string
    data: LinearWebhookPayload
    private integrationId: string

    constructor(data: LinearWebhookPayload, integrationId: string) {
        super()
        this.data = data
        this.integrationId = integrationId
        const dataId = (data.data as { id?: string })?.id
        this.entityId = `${integrationId}:${dataId ?? "unknown"}`
    }

    formatForAgentRunner(): string {
        const indentMultiline = (text: string): string =>
            text
                .split("\n")
                .map(line => `        ${line}`)
                .join("\n")

        const sections: string[] = []

        // Event summary
        sections.push(`Incoming Linear ${this.data.type} Event`)
        sections.push(`Action: ${this.data.action}`)
        sections.push(`Actor: ${this.data.actor.name} (${this.data.actor.email})`)
        sections.push(`Created: ${this.data.createdAt}`)

        // Format based on event type
        if (this.data.type === "Issue" && this.data.data) {
            const issue = this.data.data
            const issueSections: string[] = []

            issueSections.push(`Issue: ${issue.identifier} - ${issue.title}`)
            if (issue.description) {
                issueSections.push(`Description:\n${indentMultiline(issue.description)}`)
            }
            issueSections.push(`Priority: ${issue.priorityLabel || issue.priority}`)
            issueSections.push(`State: ${issue.state?.name || "Unknown"}`)
            issueSections.push(`Team: ${issue.team?.name || "Unknown"}`)

            if (issue.assignee) {
                issueSections.push(`Assignee: ${issue.assignee.name}`)
            }

            if (issue.labels && issue.labels.length > 0) {
                const labelNames = issue.labels.map((l: any) => l.name || l).join(", ")
                issueSections.push(`Labels: ${labelNames}`)
            }

            if (issue.url) {
                issueSections.push(`URL: ${issue.url}`)
            }

            sections.push(issueSections.join("\n"))
        } else if (this.data.type === "Comment" && this.data.data) {
            const comment = this.data.data as any // Comment events have different structure
            const commentSections: string[] = []

            commentSections.push(`Comment on Issue: ${comment.issueId || "Unknown"}`)
            if (comment.body) {
                commentSections.push(`Comment:\n${indentMultiline(comment.body)}`)
            }

            sections.push(commentSections.join("\n"))
        } else {
            // Generic event data
            sections.push(`Event Data:\n${indentMultiline(JSON.stringify(this.data.data, null, 2))}`)
        }

        // Organization context
        if (this.data.organizationId) {
            sections.push(`Organization ID: ${this.data.organizationId}`)
        }

        return sections.join("\n\n")
    }

    debugLog(): string {
        if (this.data.type === "Issue" && this.data.data) {
            return `Linear ${this.data.type} Event: ${this.data.data.identifier} - ${this.data.data.title} (${this.data.action})`
        } else if (this.data.type === "Comment" && this.data.data) {
            const comment = this.data.data as any // Comment events have different structure
            return `Linear ${this.data.type} Event: Comment on issue ${comment.issueId || "Unknown"} (${this.data.action})`
        }
        return `Linear ${this.data.type} Event: ${this.data.action}`
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

        // Since we don't filter for a team at the moment, nothing else to check
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
            const comment = this.data.data as any // Comment events have different structure
            // Linear webhook payload includes url field at the top level for comments
            url = this.data.url
            title = `Comment on ${comment.issueId || "Unknown Issue"}`
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

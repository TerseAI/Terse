import { InputConfigType } from "@prisma/client"
import { Request, Response } from "express"
import jwt from "jsonwebtoken"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { settings, urls } from "../config/settings"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { Identifiable } from "../rag/Hydrator"
import { StoredFile } from "../services/FileStorageService"
import { ConfigInstance, ConfigType, JiraConfig as JiraConfigClass } from "../shared/Configs"
import { FrontendRoutes } from "../shared/FrontendRoutes"
import { AdditionalStateParams, AtlassianIntegration, AtlassianIntegrationMetadata, InstallationOptionsFor, IntegrationType } from "../shared/Integrations"
import { RunHistoryTrigger } from "../shared/RunHistoryTypes"
import { OAuthInstallationDetails } from "../shared/types"
import { AgentTriggerWithConfigs } from "../types/prisma"
import { HydratorType } from "../types/rag"
import { JiraWebhookPayload } from "../utility/JiraWebhookPayload"
import { createOAuthStateToken } from "../utility/oauth"
import { getUserForOrg } from "../utility/workos"

import { AtlassianClient, AtlassianResource } from "./AtlassianClient"
import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { InputEvent } from "./abstract/InputEvent"
import { ConfigurationFieldDefinition, Integration, OAuthIntegrationInstallation } from "./abstract/Integration"

// MARK: - Integration Manager

/**
 * AtlassianIntegrationManager extends AtlassianClient to add:
 * - OAuth installation flow
 * - Webhook event processing (requires EventProcessor)
 * - Agent trigger setup/teardown
 *
 * For API-only operations (getting tokens, querying instances), use AtlassianClient directly
 * to avoid circular dependency issues.
 */
export class AtlassianIntegrationManager
    extends AtlassianClient
    implements Integration<AtlassianIntegration, JiraWebhookPayload, typeof AtlassianIntegrationMetadata, AtlassianResource>, OAuthIntegrationInstallation<IntegrationType.ATLASSIAN>
{
    constructor() {
        super()
    }

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options?: InstallationOptionsFor<IntegrationType.ATLASSIAN>,
        additionalStatePayload?: AdditionalStateParams
    ): Promise<OAuthInstallationDetails> {
        // Generate state token for security (prevents CSRF)
        const state = createOAuthStateToken({
            userId,
            organizationId,
            additionalFields: { timestamp: Date.now() },
            additionalStatePayload
        })

        const clientId = settings.atlassian.clientId
        const redirectUri = settings.atlassian.callbackUrl

        // Build OAuth URL according to Atlassian OAuth 2.0 (3LO) specification
        const scopes = [
            "offline_access",
            "read:me",
            "read:jira-work",
            "write:jira-work",
            "read:jira-user",
            "read:confluence-content.all",
            "read:confluence-space.summary",
            "read:confluence-props",
            "read:confluence-content.permission",
            "read:confluence-content.summary",
            "readonly:content.attachment:confluence",
            "search:confluence",
            "read:page:confluence",
            "write:confluence-content",
            "write:comment:confluence",
            "read:comment:confluence",
            "manage:jira-webhook"
        ].join(" ")

        const authUrl = new URL("https://auth.atlassian.com/authorize")
        authUrl.searchParams.append("audience", "api.atlassian.com")
        authUrl.searchParams.append("client_id", clientId)
        authUrl.searchParams.append("scope", scopes)
        authUrl.searchParams.append("redirect_uri", redirectUri)
        authUrl.searchParams.append("state", state)
        authUrl.searchParams.append("response_type", "code")
        authUrl.searchParams.append("prompt", "consent")

        return {
            oauthUrl: authUrl.toString()
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { code, state, error } = req.query

        if (error) {
            logger.error("Atlassian OAuth error", { error: String(error) })
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
                logger.error("Atlassian OAuth: organizationId is required in state", {
                    userId: decoded.userId
                })
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Exchange authorization code for access token
            const tokenResponse = await fetch("https://auth.atlassian.com/oauth/token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    grant_type: "authorization_code",
                    client_id: settings.atlassian.clientId,
                    client_secret: settings.atlassian.clientSecret,
                    code: code as string,
                    redirect_uri: settings.atlassian.callbackUrl
                })
            })

            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text()
                logger.error("Atlassian token exchange failed", { error: errorText })
                throw new Error(`Atlassian token exchange failed: ${errorText}`)
            }

            const tokenData = await tokenResponse.json()
            const { access_token, expires_in, scope } = tokenData

            if (!access_token) {
                throw new Error("No access token received from Atlassian")
            }

            // Calculate token expiry
            const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000)

            // Get user info and accessible resources
            // First, get the user's accessible sites/resources
            const resourcesResponse = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json"
                }
            })

            if (!resourcesResponse.ok) {
                const errorText = await resourcesResponse.text()
                logger.error("Failed to get accessible resources", {
                    error: errorText
                })
                throw new Error(`Failed to get accessible resources: ${errorText}`)
            }

            const resources = await resourcesResponse.json()

            if (!resources || resources.length === 0) {
                logger.error("No accessible resources found")
                res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
                return
            }

            // Get user info from the first accessible resource
            // We'll use the first resource as the primary integration
            const primaryResource = resources[0]
            const cloudId = primaryResource.id
            const baseUrl = primaryResource.url

            // Get user info using the cloudid
            const userInfoResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${access_token}`,
                    Accept: "application/json"
                }
            })

            let jiraUserEmail: string | null = null
            let accountId: string | null = null
            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json()
                jiraUserEmail = userInfo.emailAddress || null
                accountId = userInfo.accountId || null
            } else {
                // Try to get user info from the /me endpoint
                const meResponse = await fetch("https://api.atlassian.com/me", {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${access_token}`,
                        Accept: "application/json"
                    }
                })
                if (meResponse.ok) {
                    const meInfo = await meResponse.json()
                    jiraUserEmail = meInfo.email || null
                    accountId = meInfo.accountId || null
                }
            }

            if (!jiraUserEmail) {
                logger.warn("⚠️  Could not determine user email from Atlassian API")
            }

            const url = new URL(baseUrl)
            const siteName = url.hostname.replace(/\.atlassian\.net$/, "")

            logger.info("🏢 Atlassian site:", { siteName, cloudId })

            // Check if a connection for this base_url already exists
            const existing = await db().atlassian_integrations.findFirst({
                where: {
                    organization_id: decoded.organizationId,
                    base_url: baseUrl
                }
            })

            // Note: We don't store refresh_token separately for Atlassian OAuth 2.0 (3LO)
            // The offline_access scope should provide a refresh token, but we need to check the response
            const refreshToken = tokenData.refresh_token || null

            // Create webhook for Jira events (if accountId is available)
            let webhookId: string | null = null
            let webhookSecret: string | null = null

            if (accountId) {
                try {
                    // Delete existing webhook if present
                    if (existing?.webhook_id) {
                        try {
                            await this.deleteJiraWebhook(cloudId, access_token, existing.webhook_id)
                        } catch (error) {
                            logger.warn("⚠️  Could not delete existing webhook, continuing with creation", { error })
                        }
                    }

                    const webhook = await this.createJiraWebhook(cloudId, access_token, accountId)
                    webhookId = webhook.webhookId
                    webhookSecret = webhook.webhookSecret
                } catch (error) {
                    logger.error("⚠️  Failed to create webhook, continuing without it", {
                        error
                    })
                    // Continue with installation even if webhook creation fails
                }
            } else {
                logger.warn("⚠️  Could not determine accountId, skipping webhook creation")
            }

            let integrationId: string
            if (!existing) {
                const newIntegration = await db().atlassian_integrations.create({
                    data: {
                        user_id: decoded.userId,
                        organization_id: decoded.organizationId,
                        jira_user_email: jiraUserEmail || "",
                        base_url: baseUrl,
                        cloud_id: cloudId,
                        site_name: siteName,
                        webhook_id: webhookId,
                        webhook_secret: webhookSecret,
                        access_token: access_token,
                        refresh_token: refreshToken || "",
                        token_expiry: tokenExpiry
                    }
                })
                integrationId = newIntegration.id
                logger.info("✅ Created Atlassian OAuth connection:", {
                    siteName,
                    webhookId: webhookId ? "with webhook" : "no webhook"
                })
            } else {
                // Update existing connection with new token (in case it was revoked and re-authorized)
                await db().atlassian_integrations.update({
                    where: { id: existing.id },
                    data: {
                        organization_id: decoded.organizationId,
                        cloud_id: cloudId, // Update cloud_id in case it changed
                        access_token: access_token,
                        refresh_token: refreshToken || existing.refresh_token, // Preserve existing refresh token if new one not provided
                        token_expiry: tokenExpiry,
                        jira_user_email: jiraUserEmail || existing.jira_user_email,
                        webhook_id: webhookId || existing.webhook_id, // Update webhook if created, otherwise keep existing
                        webhook_secret: webhookSecret || existing.webhook_secret
                    }
                })
                integrationId = existing.id
                logger.info("✅ Updated Atlassian OAuth connection token:", {
                    siteName,
                    webhookId: webhookId ? "with webhook" : "no webhook"
                })
            }

            logger.info("✅ Atlassian OAuth completed for user:", {
                userId: decoded.userId
            })

            // Emit integration completed task (includes full state payload for chat metadata detection)
            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.ATLASSIAN, integrationId, decoded.userId, decoded, new Date()))

            // Redirect to success page which will auto-close the popup
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("Error in Atlassian OAuth callback", { error })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    async processWebhookEvent(event: JiraWebhookPayload): Promise<void> {
        // Extract base URL from the issue self URL or match by user email
        // The webhook payload includes user email, which we can use to match integrations
        const userEmail = event.user?.emailAddress
        const issueUrl = event.issue?.self

        if (!userEmail && !issueUrl) {
            logger.info("⚠️  [JIRA INTEGRATION MANAGER] No user email or issue URL found in webhook payload")
            return
        }

        // Try to extract base URL from issue self URL
        let baseUrl: string | null = null
        if (issueUrl) {
            try {
                const url = new URL(issueUrl)
                // Extract base URL (e.g., https://company.atlassian.net from https://company.atlassian.net/rest/api/3/issue/123)
                baseUrl = `${url.protocol}//${url.hostname}`
            } catch (error) {
                logger.warn("⚠️  Could not parse issue URL", { issueUrl, error })
            }
        }

        // Find matching integrations
        // Match by user email or base URL
        const matchingIntegrations = await db().atlassian_integrations.findMany({
            where: {
                OR: [...(userEmail ? [{ jira_user_email: userEmail }] : []), ...(baseUrl ? [{ base_url: baseUrl }] : [])]
            },
            include: {
                user: true
            }
        })

        if (matchingIntegrations.length === 0) {
            logger.info(`⚠️  [JIRA INTEGRATION MANAGER] No integrations found for user email: ${userEmail || "N/A"} or base URL: ${baseUrl || "N/A"}`)
            return
        }

        logger.info(`✅ [JIRA INTEGRATION MANAGER] Found ${matchingIntegrations.length} matching integration(s)`)

        // Process event for each matching integration
        for (const integration of matchingIntegrations) {
            if (!integration.organization_id) {
                continue
            }
            const user = await getUserForOrg(integration.user_id, integration.organization_id)
            if (!user) {
                continue
            }
            try {
                // Process with user context for logging
                await runWithUserContext(user, async () => {
                    // Enrich context using JiraAdapter if needed
                    let enrichedEvent = event
                    try {
                        // If this is an issue event, we could fetch additional details
                        if (event.issue?.id && integration.cloud_id && integration.access_token) {
                            // For now, we'll use the event as-is since it already contains rich information
                            // Future: Could fetch additional context using OAuth token
                            logger.info(`📊 [JIRA INTEGRATION MANAGER] Using webhook payload for issue ${event.issue.key}`)
                        }
                    } catch (error) {
                        logger.info(`⚠️  [JIRA INTEGRATION MANAGER] Error enriching context: ${error}`)
                        // Continue with original event if enrichment fails
                    }

                    // Create JiraEvent and process it
                    const jiraEvent = new JiraEvent(enrichedEvent, integration.id)
                    const eventProcessor = new EventProcessor(jiraEvent, user)
                    await eventProcessor.process()
                })
            } catch (error) {
                logger.error(`❌ [JIRA INTEGRATION MANAGER] Error processing event for integration ${integration.id}`, {
                    error,
                    integrationId: integration.id
                })
                // Continue processing other integrations even if one fails
            }
        }
    }

    async setupAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {
        try {
            // Get the integration
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration) {
                logger.warn(`⚠️  Integration ${integrationId} not found, skipping webhook setup`, { integrationId })
                return
            }

            // In development, always recreate webhook to ensure URL is current
            // (especially important when using Cloudflare tunnels that change URLs)
            const isDevelopment = settings.nodeEnv === "development"

            // In development, always delete existing webhook and recreate to ensure URL is current
            if (isDevelopment && integration.webhook_id) {
                logger.info("🔄 Development mode: recreating webhook for integration", {
                    integrationId
                })

                if (integration.cloud_id) {
                    // Get valid access token before using it
                    const accessToken = await this.getAccessToken(integrationId)
                    if (accessToken) {
                        try {
                            await this.deleteJiraWebhook(integration.cloud_id, accessToken, integration.webhook_id)
                        } catch (error) {
                            logger.warn("⚠️  Could not delete existing webhook, continuing with creation", { error, integrationId })
                        }
                    }
                }
            } else if (integration.webhook_id) {
                // Not localhost and webhook exists - leave it as is
                logger.info("✅ Webhook already exists for integration", {
                    integrationId,
                    webhookId: integration.webhook_id
                })
                return
            }

            // Webhook doesn't exist or we're on localhost and need to recreate it
            // First, get the accountId from the API
            if (!integration.cloud_id) {
                logger.warn("⚠️  Integration missing cloud_id, cannot create webhook", {
                    integrationId
                })
                return
            }

            // Get valid access token before using it
            const accessToken = await this.getAccessToken(integrationId)
            if (!accessToken) {
                logger.warn("⚠️  Could not get valid access token for integration", {
                    integrationId
                })
                return
            }

            logger.info("🔧 Creating webhook for integration", { integrationId })

            // Get user accountId from Jira API
            const userInfoResponse = await fetch(`https://api.atlassian.com/ex/jira/${integration.cloud_id}/rest/api/3/myself`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json"
                }
            })

            let accountId: string | null = null
            if (userInfoResponse.ok) {
                const userInfo = await userInfoResponse.json()
                accountId = userInfo.accountId || null
            } else {
                // Try the /me endpoint as fallback
                const meResponse = await fetch("https://api.atlassian.com/me", {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: "application/json"
                    }
                })
                if (meResponse.ok) {
                    const meInfo = await meResponse.json()
                    accountId = meInfo.accountId || null
                }
            }

            if (!accountId) {
                logger.warn(`⚠️  Could not determine accountId for integration ${integrationId}, skipping webhook creation`, { integrationId })
                return
            }

            // Create the webhook
            const webhook = await this.createJiraWebhook(integration.cloud_id, accessToken, accountId)

            // Update the integration with the webhook ID
            await db().atlassian_integrations.update({
                where: { id: integrationId },
                data: {
                    webhook_id: webhook.webhookId,
                    webhook_secret: webhook.webhookSecret
                }
            })

            logger.info("✅ Created and registered webhook for integration", {
                integrationId,
                webhookId: webhook.webhookId
            })
        } catch (error) {
            logger.error(`❌ Error setting up webhook for integration ${integrationId}`, {
                error,
                integrationId
            })
            // Don't throw - allow automation setup to continue even if webhook creation fails
        }
    }

    async teardownAgentTrigger(integrationId: string, automationInput: AgentTriggerWithConfigs): Promise<void> {
        try {
            // Get the integration
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration || !integration.webhook_id) {
                // No webhook to clean up
                return
            }

            // Check if there are other automations using this integration
            // Query for automations with this integration_id, excluding the current automation
            const otherAutomations = await db().automation_inputs.findMany({
                where: {
                    integration_id: integrationId,
                    automation_id: {
                        not: automationInput.automation_id
                    },
                    config_type: InputConfigType.JIRA
                },
                select: {
                    automation_id: true
                }
            })

            // If there are other automations using this integration, keep the webhook
            if (otherAutomations.length > 0) {
                logger.info("ℹ️  Keeping webhook for integration", {
                    integrationId,
                    otherAutomationsCount: otherAutomations.length
                })
                return
            }

            // No other automations use this integration, safe to delete the webhook
            logger.info("🗑️  Deleting webhook for integration", { integrationId })

            if (!integration.cloud_id) {
                logger.warn(`⚠️  Integration ${integrationId} missing cloud_id, cannot delete webhook`, { integrationId })
                // Still clear the webhook_id from the database
                await db().atlassian_integrations.update({
                    where: { id: integrationId },
                    data: {
                        webhook_id: null,
                        webhook_secret: null
                    }
                })
                return
            }

            // Get valid access token before using it
            const accessToken = await this.getAccessToken(integrationId)
            if (!accessToken) {
                logger.warn(`⚠️  Could not get valid access token for integration ${integrationId}, cannot delete webhook`, { integrationId })
                // Still clear the webhook_id from the database
                await db().atlassian_integrations.update({
                    where: { id: integrationId },
                    data: {
                        webhook_id: null,
                        webhook_secret: null
                    }
                })
                return
            }

            // Delete the webhook from Jira
            try {
                await this.deleteJiraWebhook(integration.cloud_id, accessToken, integration.webhook_id)
            } catch (error) {
                logger.error(`⚠️  Failed to delete webhook from Jira, but clearing from database`, { error, integrationId })
            }

            // Clear the webhook_id from the database
            await db().atlassian_integrations.update({
                where: { id: integrationId },
                data: {
                    webhook_id: null,
                    webhook_secret: null
                }
            })

            logger.info("✅ Deleted webhook for integration", { integrationId })
        } catch (error) {
            logger.error(`❌ Error tearing down webhook for integration ${integrationId}`, {
                error,
                integrationId
            })
            // Don't throw - allow automation teardown to continue even if webhook deletion fails
        }
    }

    async getSampleEvents(integrationId: string, triggerConfig: ConfigInstance, options?: { limit?: number }): Promise<InputEvent[]> {
        if (triggerConfig.configType !== ConfigType.JIRA) {
            return []
        }
        const jiraConfig = triggerConfig as JiraConfigClass

        const limit = Math.min(options?.limit ?? 5, 10)
        await this.refreshToken(integrationId)

        const atlassianIntegration = await db().atlassian_integrations.findUnique({
            where: { id: integrationId }
        })
        if (!atlassianIntegration?.cloud_id || !atlassianIntegration.access_token) {
            throw new Error(`Atlassian integration ${integrationId} not found or missing credentials`)
        }

        const accessToken = await this.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Atlassian access token not found for integration ${integrationId}. Please reconnect.`)
        }

        let jqlQuery: string
        if (jiraConfig.projectKey) {
            jqlQuery = `project = ${jiraConfig.projectKey} ORDER BY created DESC`
        } else {
            const projectKeys = await this.fetchAccessibleProjectKeysForSample(atlassianIntegration.cloud_id, accessToken)
            if (projectKeys.length === 0) {
                return []
            }
            jqlQuery = `project in (${projectKeys.join(",")}) ORDER BY created DESC`
        }

        const issues = await this.searchJiraIssuesForSample(atlassianIntegration.cloud_id, accessToken, jqlQuery, limit)
        const events: InputEvent[] = issues.map(issue => new JiraEvent(convertJiraIssueToWebhookPayload(issue), integrationId))
        return events
    }

    private async fetchAccessibleProjectKeysForSample(cloudId: string, accessToken: string): Promise<string[]> {
        const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        })
        if (!response.ok) return []
        const projects = (await response.json()) as Array<{ key: string }>
        return (projects || []).map(p => p.key)
    }

    private async searchJiraIssuesForSample(
        cloudId: string,
        accessToken: string,
        jqlQuery: string,
        maxResults: number
    ): Promise<Array<{ id: string; self: string; key: string; fields: Record<string, unknown> }>> {
        const params = new URLSearchParams({
            jql: jqlQuery,
            maxResults: String(maxResults),
            fields: "summary,description,status,priority,issuetype,project,assignee,creator,created,updated,labels,duedate"
        })
        const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        })
        if (!response.ok) {
            const errorText = await response.text()
            logger.error("Jira search failed for sample events", { status: response.status, error: errorText })
            throw new Error(`Failed to search Jira issues: ${response.status}`)
        }
        const data = (await response.json()) as { issues?: Array<{ id: string; self: string; key: string; fields: Record<string, unknown> }> }
        return data.issues || []
    }
}

// MARK: - Event Definition

function createDefaultJiraUser(): JiraWebhookPayload["user"] {
    return {
        self: "",
        name: "Unknown",
        key: "",
        emailAddress: "",
        avatarUrls: { "48x48": "", "24x24": "", "16x16": "", "32x32": "" },
        displayName: "Unknown",
        active: true
    }
}

function convertJiraIssueToWebhookPayload(issue: { id: string; self: string; key: string; fields: Record<string, unknown> }): JiraWebhookPayload {
    const fields = issue.fields as any
    const status = fields?.status || {}
    const priority = fields?.priority || {}
    const issuetype = fields?.issuetype || {}
    const project = fields?.project || {}
    const creator = fields?.creator || createDefaultJiraUser()

    return {
        timestamp: Date.now(),
        webhookEvent: "jira:issue_created",
        user: creator,
        issue: {
            id: issue.id,
            self: issue.self,
            key: issue.key,
            fields: {
                statuscategorychangedate: fields?.updated || new Date().toISOString(),
                issuetype: {
                    self: issuetype.self || "",
                    id: issuetype.id || "",
                    description: issuetype.description || "",
                    iconUrl: issuetype.iconUrl || "",
                    name: issuetype.name || "",
                    subtask: issuetype.subtask || false,
                    avatarId: issuetype.avatarId
                },
                project: {
                    self: project.self || "",
                    id: project.id || "",
                    key: project.key || "",
                    name: project.name || "",
                    projectTypeKey: project.projectTypeKey || "software",
                    simplified: project.simplified || false,
                    avatarUrls: project.avatarUrls || { "48x48": "", "24x24": "", "16x16": "", "32x32": "" }
                },
                fixVersions: [],
                workratio: 0,
                watches: { self: "", watchCount: 0, isWatching: false },
                created: fields?.created || new Date().toISOString(),
                priority: {
                    self: priority.self || "",
                    iconUrl: priority.iconUrl || "",
                    name: priority.name || "",
                    id: priority.id || ""
                },
                labels: (fields?.labels as string[]) || [],
                versions: [],
                issuelinks: [],
                assignee: fields?.assignee ?? null,
                updated: fields?.updated || new Date().toISOString(),
                status: {
                    self: status.self || "",
                    description: status.description || "",
                    iconUrl: status.iconUrl || "",
                    name: status.name || "",
                    id: status.id || "",
                    statusCategory: status.statusCategory || {
                        self: "",
                        id: 0,
                        key: "",
                        colorName: "",
                        name: ""
                    }
                },
                components: [],
                timetracking: {},
                attachment: [],
                description: fields?.description,
                summary: fields?.summary || "",
                creator,
                subtasks: [],
                reporter: fields?.reporter || creator,
                aggregateprogress: { progress: 0, total: 0 },
                duedate: fields?.duedate,
                progress: { progress: 0, total: 0 },
                votes: { self: "", votes: 0, hasVoted: false }
            }
        }
    }
}

// MARK: - Event Definition

export class JiraEvent extends InputEvent implements Identifiable {
    readonly integrationType: IntegrationType = IntegrationType.ATLASSIAN
    entityType = HydratorType.JIRA_EVENT
    entityId: string
    data: JiraWebhookPayload
    private integrationId: string
    private storedFiles: StoredFile[]

    constructor(data: JiraWebhookPayload, integrationId: string, storedFiles: StoredFile[] = []) {
        super()
        this.data = data
        this.integrationId = integrationId
        this.storedFiles = storedFiles
        const issue = data.issue
        this.entityId = `${integrationId}:${issue?.key ?? issue?.id ?? "unknown"}`
    }

    formatForAgentRunner(): string {
        const indentMultiline = (text: string): string =>
            text
                .split("\n")
                .map(line => `        ${line}`)
                .join("\n")

        const sections: string[] = []

        // Event summary
        sections.push(`Incoming Jira ${this.data.webhookEvent} Event`)
        sections.push(`User: ${this.data.user.displayName} (${this.data.user.emailAddress})`)
        sections.push(`Timestamp: ${new Date(this.data.timestamp).toISOString()}`)

        // Format based on event type
        if (this.data.issue) {
            const issue = this.data.issue
            const issueSections: string[] = []

            issueSections.push(`Issue: ${issue.key} - ${issue.fields.summary}`)
            if (issue.fields.description) {
                issueSections.push(`Description:\n${indentMultiline(issue.fields.description)}`)
            }
            issueSections.push(`Status: ${issue.fields.status.name}`)
            if (issue.fields.priority) {
                issueSections.push(`Priority: ${issue.fields.priority.name}`)
            }
            issueSections.push(`Project: ${issue.fields.project.name} (${issue.fields.project.key})`)
            issueSections.push(`Issue Type: ${issue.fields.issuetype.name}`)

            if (issue.fields.assignee) {
                issueSections.push(`Assignee: ${issue.fields.assignee.displayName}`)
            }

            if (issue.fields.labels && issue.fields.labels.length > 0) {
                issueSections.push(`Labels: ${issue.fields.labels.join(", ")}`)
            }

            if (issue.fields.duedate) {
                issueSections.push(`Due Date: ${issue.fields.duedate}`)
            }

            // Convert REST API URL to browse URL using issue key
            let issueUrl = issue.self
            if (issue.self && issue.key) {
                try {
                    const urlObj = new URL(issue.self)
                    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`
                    issueUrl = `${baseUrl}/browse/${issue.key}`
                } catch (error) {
                    // Fallback to string replacement if URL parsing fails
                    issueUrl = issue.self.replace(/\/rest\/api\/[23]\/issue\//, "/browse/")
                }
            }
            issueSections.push(`URL: ${issueUrl}`)

            // Add changelog if present (shows what changed)
            if (this.data.changelog && this.data.changelog.items && this.data.changelog.items.length > 0) {
                const changeSections: string[] = []
                changeSections.push(`Changes:`)
                this.data.changelog.items.forEach(item => {
                    changeSections.push(`  - ${item.field}: "${item.fromString || "None"}" → "${item.toString || "None"}"`)
                })
                issueSections.push(changeSections.join("\n"))
            }

            sections.push(issueSections.join("\n"))
        }

        // Handle comment events
        if (this.data.comment) {
            const comment = this.data.comment
            const commentSections: string[] = []

            commentSections.push(`Comment on Issue: ${this.data.issue?.key || "Unknown"}`)
            commentSections.push(`Author: ${comment.author.displayName} (${comment.author.emailAddress})`)
            commentSections.push(`Created: ${comment.created}`)
            if (comment.body) {
                commentSections.push(`Comment:\n${indentMultiline(comment.body)}`)
            }

            sections.push(commentSections.join("\n"))
        }

        return sections.join("\n\n")
    }

    debugLog(): string {
        const issue = this.data.issue
        const comment = this.data.comment

        if (issue) {
            return `Jira ${this.data.webhookEvent}: ${issue.key} - ${issue.fields.summary}`
        } else if (comment) {
            // Use this.data.issue directly to avoid type narrowing issues
            const issueKey = this.data.issue?.key || "Unknown Issue"
            return `Jira ${this.data.webhookEvent}: Comment on ${issueKey}`
        }
        return `Jira ${this.data.webhookEvent}`
    }

    matchesAgentTrigger(automationInput: AgentTriggerWithConfigs): boolean {
        logger.debug(`Checking if Jira event matches automation input: ${automationInput.config_type}`, { configType: automationInput.config_type })
        // Check if integration type matches
        if (automationInput.config_type !== InputConfigType.JIRA) {
            return false
        }

        // Get the Jira config if it exists
        const jiraConfig = automationInput.jira_config

        // If no project filter is configured, match all Jira events
        if (!jiraConfig || (!jiraConfig.project_key && !jiraConfig.project_id)) {
            return true
        }

        // Extract project information from the event
        const eventIssue = this.data.issue
        if (!eventIssue) {
            // For comment-only events, check if there's an issue in the payload
            // Comments can have an associated issue
            if (this.data.comment && !eventIssue) {
                // Comment events without issue info - skip filtering (match all)
                return true
            }
            return false
        }

        const eventProjectKey = eventIssue.fields.project.key
        const eventProjectId = eventIssue.fields.project.id

        // Check if project matches by key or ID
        if (jiraConfig.project_key && jiraConfig.project_key === eventProjectKey) {
            return true
        }

        if (jiraConfig.project_id && jiraConfig.project_id === eventProjectId) {
            return true
        }

        // No match - event is for a different project
        return false
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // Create event name from webhookEvent (e.g., "jira:issue_created" → "jira_issue_created")
        const eventName = this.data.webhookEvent.replace(/:/g, "_").toLowerCase()

        // Extract issue and comment to avoid type narrowing issues
        const issue = this.data.issue
        const comment = this.data.comment

        // Get URL, title, subheader, and source from event data
        let url: string | undefined
        let title: string | undefined
        let subheader: string | undefined
        let source: string

        if (issue) {
            // Convert REST API URL to browse URL
            // Handle both /rest/api/2/issue/ and /rest/api/3/issue/ formats
            // Use issue key to construct proper browse URL: https://domain.atlassian.net/browse/KEY-123
            if (issue.self) {
                try {
                    const urlObj = new URL(issue.self)
                    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`
                    url = `${baseUrl}/browse/${issue.key}`
                } catch (error) {
                    // Fallback to string replacement if URL parsing fails
                    url = issue.self.replace(/\/rest\/api\/[23]\/issue\//, "/browse/")
                }
            }
            title = issue.fields.summary
            subheader = `${issue.key} - ${issue.fields.status.name}`
            source = issue.fields.project.name || issue.fields.project.key
        } else if (comment) {
            // For comment events, construct URL from issue if available
            // Use this.data.issue directly to avoid type narrowing issues
            const commentIssue = this.data.issue
            if (commentIssue) {
                // Convert REST API URL to browse URL using issue key
                if (commentIssue.self) {
                    try {
                        const urlObj = new URL(commentIssue.self)
                        const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`
                        url = `${baseUrl}/browse/${commentIssue.key}`
                    } catch (error) {
                        // Fallback to string replacement if URL parsing fails
                        url = commentIssue.self.replace(/\/rest\/api\/[23]\/issue\//, "/browse/")
                    }
                }
                title = `Comment on ${commentIssue.key}`
                source = commentIssue.fields.project.name || commentIssue.fields.project.key
            } else {
                title = "Comment"
                source = "Jira"
            }
            subheader = comment.author.displayName
        } else {
            // Generic fallback
            title = this.data.webhookEvent
            subheader = this.data.user.displayName
            source = "Jira"
        }

        return {
            event: eventName,
            integration: IntegrationType.ATLASSIAN,
            source: source,
            title: title,
            subheader: subheader,
            url: url
        }
    }

    getFiles(): StoredFile[] {
        return this.storedFiles
    }
}

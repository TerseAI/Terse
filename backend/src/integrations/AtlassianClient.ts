import { settings, urls } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { ApiRoutes } from "../shared/ApiRoutes"
import { AtlassianIntegration, IntegrationType } from "../shared/Integrations"
import type { ConfluencePage, User } from "../shared/types"
import { generateWebhookSecret } from "../utility/webhookSecrets"

import { FetchResourcesOptions } from "./abstract/FetchResourcesOptions"
import { IntegrationWithResources } from "./abstract/Integration"

/** Combined Jira + Confluence resource shape returned by fetchResourcesForOrganization */
export type AtlassianResource = {
    jira: { projects: unknown[]; baseUrl?: string; cloudId?: string }
    confluence: { success: true; resources: unknown[]; total: number }
}

const OAUTH_TOKEN_REFRESH_THRESHOLD_MS = 1000 * 60 * 30 // 30 minutes (expires access token after 1 hour)

/**
 * AtlassianClient provides API methods for interacting with Atlassian services.
 * This class is separated from AtlassianIntegrationManager to avoid circular dependencies.
 *
 * Use this class when you need to:
 * - Get access tokens for API calls
 * - Query integration instances
 * - Manage webhooks
 *
 * For OAuth installation and webhook event processing, use AtlassianIntegrationManager instead.
 */
export class AtlassianClient {
    integrationType: IntegrationType = IntegrationType.ATLASSIAN

    async getAccessToken(integrationId: string): Promise<string | null> {
        try {
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration) {
                logger.error(`Atlassian integration ${integrationId} not found`, {
                    integrationId
                })
                return null
            }

            const now = new Date()
            // Check if token is expired or will expire within the refresh threshold
            if (integration.token_expiry && integration.token_expiry <= new Date(now.getTime() + OAUTH_TOKEN_REFRESH_THRESHOLD_MS)) {
                logger.info(`Atlassian access token expiring soon for integration ${integrationId}, refreshing...`, { integrationId })

                if (!integration.refresh_token || integration.refresh_token === "") {
                    logger.error(`No refresh token available for Atlassian integration ${integrationId}`, { integrationId })
                    return null
                }

                // Exchange refresh token for new access token
                const tokenResponse = await fetch("https://auth.atlassian.com/oauth/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        grant_type: "refresh_token",
                        client_id: settings.atlassian.clientId,
                        client_secret: settings.atlassian.clientSecret,
                        refresh_token: integration.refresh_token
                    })
                })

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text()
                    logger.error(`Atlassian token refresh failed for integration ${integrationId}`, { error: errorText, integrationId })
                    // Return existing token as fallback - it might still work
                    return integration.access_token
                }

                const tokenData = await tokenResponse.json()
                const { access_token, refresh_token, expires_in } = tokenData

                if (!access_token) {
                    logger.error(`No access token received from Atlassian refresh for integration ${integrationId}`, { integrationId })
                    // Return existing token as fallback
                    return integration.access_token
                }

                // Calculate token expiry
                const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000)

                // Update the database with new tokens
                await db().atlassian_integrations.update({
                    where: { id: integration.id },
                    data: {
                        access_token: access_token,
                        refresh_token: refresh_token || integration.refresh_token, // Preserve existing if new one not provided
                        token_expiry: tokenExpiry
                    }
                })

                logger.info(`Successfully refreshed Atlassian access token for integration ${integrationId}`, { integrationId })
                return access_token
            }

            // Token is still valid
            return integration.access_token
        } catch (error) {
            logger.error(`Error ensuring valid access token for integration ${integrationId}`, {
                error,
                integrationId
            })
            // Return null on error - caller should handle
            return null
        }
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        try {
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration) {
                logger.warn(`Atlassian integration ${integrationId} not found`, {
                    integrationId
                })
                return false
            }

            // Store the original token expiry to detect if refresh happened
            const originalTokenExpiry = integration.token_expiry

            // Use getAccessToken which internally handles token refresh
            const accessToken = await this.getAccessToken(integrationId)
            if (!accessToken) {
                // getAccessToken returns null on error, but might return existing token as fallback
                // Check if token was actually refreshed by comparing expiry dates
                const updatedIntegration = await db().atlassian_integrations.findUnique({
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
            const updatedIntegration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId },
                select: { token_expiry: true }
            })

            if (!updatedIntegration || !originalTokenExpiry || !updatedIntegration.token_expiry) {
                return false
            }

            // Token was refreshed if expiry changed
            return updatedIntegration.token_expiry.getTime() !== originalTokenExpiry.getTime()
        } catch (error) {
            logger.error(`Error refreshing Atlassian token for integration ${integrationId}`, { error, integrationId })
            return false
        }
    }

    async getInstancesForOrganization(organizationId: string): Promise<AtlassianIntegration[]> {
        const integrations = await db().atlassian_integrations.findMany({
            where: { organization_id: organizationId },
            select: {
                id: true,
                jira_user_email: true,
                base_url: true,
                site_name: true
            }
        })
        return integrations.map(oi => ({
            id: oi.id,
            email: oi.jira_user_email,
            baseUrl: oi.base_url,
            siteName: oi.site_name || undefined
        }))
    }

    async getAllActiveInstances(): Promise<AtlassianIntegration[]> {
        const integrations = await db().atlassian_integrations.findMany({
            select: {
                id: true,
                jira_user_email: true,
                base_url: true,
                site_name: true
            }
        })
        return integrations.map(oi => ({
            id: oi.id,
            email: oi.jira_user_email,
            baseUrl: oi.base_url,
            siteName: oi.site_name || undefined
        }))
    }

    async fetchResourcesForOrganization(organizationId: string, query?: string, _options?: FetchResourcesOptions): Promise<IntegrationWithResources<AtlassianIntegration, AtlassianResource>[]> {
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
                    const [jiraResponse, confluenceResponse] = await Promise.all([
                        fetchJiraResources(organizationId, integration.id),
                        fetchConfluenceResources(organizationId, integration.id, query ?? "")
                    ])
                    const projects = jiraResponse.resources?.projects ?? []
                    const filteredProjects = normalizedQuery ? projects.filter((project: { name?: string; key?: string }) => matchesQuery(project.name) || matchesQuery(project.key)) : projects
                    return {
                        integration,
                        resources: [
                            {
                                jira: { ...jiraResponse.resources, projects: filteredProjects },
                                confluence: confluenceResponse
                            }
                        ]
                    }
                } catch (error) {
                    logger.warn(`Failed to fetch resources for Atlassian integration ${integration.id}`, { error, integrationId: integration.id })
                    return {
                        integration,
                        resources: []
                    }
                }
            })
        )
    }

    formatIntegrationInstanceForAgent(instance: AtlassianIntegration): string {
        const details: string[] = []
        if (instance.siteName) {
            details.push(`site "${instance.siteName}"`)
        } else if (instance.baseUrl) {
            details.push(`site ${instance.baseUrl}`)
        }
        if (instance.email) {
            details.push(`email ${instance.email}`)
        }
        if (instance.projectKey) {
            details.push(`project ${instance.projectKey}`)
        } else if (instance.projectName) {
            details.push(`project "${instance.projectName}"`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Atlassian${detailText} [id: ${instance.id}]`
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        try {
            // Fetch the integration to get webhook details
            const integration = await db().atlassian_integrations.findUnique({
                where: { id: integrationId }
            })

            if (!integration) {
                logger.warn("⚠️  Integration not found for deletion", {
                    integrationId
                })
                return
            }

            // Delete webhook if it exists
            if (integration.webhook_id && integration.cloud_id) {
                // Get valid access token before using it
                const accessToken = await this.getAccessToken(integration.id)
                if (accessToken) {
                    try {
                        await this.deleteJiraWebhook(integration.cloud_id, accessToken, integration.webhook_id)
                    } catch (error) {
                        logger.error("⚠️  Failed to delete webhook during integration deletion", { error, integrationId })
                        // Continue with deletion even if webhook deletion fails
                    }
                }
            }

            // Delete the integration record
            await db().atlassian_integrations.delete({
                where: { id: integrationId }
            })

            logger.info("✅ [JIRA INTEGRATION MANAGER] Deleted Atlassian integration:", { integrationId })
        } catch (error) {
            logger.error("Error deleting Atlassian integration:", { error })
            throw error
        }
    }

    // MARK: - Webhook Management

    /**
     * Creates a Jira webhook using OAuth bearer token authentication
     * Events tracked: issue creation, updates, comments for ticket management automation
     */
    async createJiraWebhook(cloudId: string, accessToken: string, accountId: string): Promise<{ webhookId: string; webhookSecret: string }> {
        const webhookSecret = generateWebhookSecret(32)
        const backendUrl = urls.backend

        // Webhook events relevant for a bot automating ticket management
        const webhookEvents = [
            "jira:issue_created", // New tickets
            "jira:issue_updated", // State changes, assignments, field updates
            "comment_created", // Comments added to issues
            "comment_updated", // Comments edited
            "comment_deleted" // Comments removed
        ]

        const webhookUrl = `${backendUrl}${ApiRoutes.WEBHOOKS.JIRA_BY_ACCOUNT_ID.build(accountId)}`

        // For Jira Cloud OAuth 2.0 apps, use the REST API v3 webhook endpoint
        // Documentation: https://developer.atlassian.com/cloud/jira/platform/webhooks/
        const webhookEndpoint = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/webhook`

        const webhookPayload = {
            url: webhookUrl,
            webhooks: [
                {
                    // Jira doesn't allow empty jqlFilter, so we use a dummy project key that doesn't exist
                    // https://community.developer.atlassian.com/t/listening-for-changes-update-delete-in-all-issues-of-the-workspace/56266/6
                    jqlFilter: "issueKey != NONEXISTENTPROJECT-1",
                    events: webhookEvents
                }
            ]
        }

        const webhookResponse = await fetch(webhookEndpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(webhookPayload)
        })

        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text()
            logger.error("Failed to create Jira webhook", { error: errorText })
            throw new Error(`Failed to create Jira webhook: ${errorText}`)
        }

        // Parse the webhook registration response
        // Response format: { "webhookRegistrationResult": [{ "createdWebhookId": 1 }, ...] }
        const response = (await webhookResponse.json()) as JiraWebhookRegistrationResponse

        // Extract the results array from the response wrapper
        const webhookResults = response.webhookRegistrationResult

        if (!Array.isArray(webhookResults) || webhookResults.length === 0) {
            throw new Error("Invalid webhook response format: missing webhookRegistrationResult array")
        }

        const firstResult = webhookResults[0]

        // Check for errors
        if (firstResult.errors && firstResult.errors.length > 0) {
            throw new Error(`Webhook registration failed: ${firstResult.errors.join(", ")}`)
        }

        // Extract webhook ID from the response
        const webhookId = firstResult.createdWebhookId?.toString()

        if (!webhookId) {
            throw new Error("Could not extract webhook ID from Jira API response")
        }

        logger.info("✅ Created Jira webhook", {
            webhookId,
            events: webhookEvents.join(", ")
        })

        return { webhookId, webhookSecret }
    }

    /**
     * Deletes a Jira webhook using OAuth bearer token authentication
     */
    async deleteJiraWebhook(cloudId: string, accessToken: string, webhookId: string): Promise<void> {
        // For Jira Cloud OAuth 2.0 apps, delete webhooks using the REST API v3 endpoint
        // Format: DELETE /rest/api/3/webhook with body { "webhookIds": [id1, id2, ...] }
        const webhookEndpoint = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/webhook`

        const webhookResponse = await fetch(webhookEndpoint, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                webhookIds: [parseInt(webhookId, 10)]
            })
        })

        if (!webhookResponse.ok && webhookResponse.status !== 404) {
            const errorText = await webhookResponse.text()
            logger.error("Failed to delete Jira webhook", {
                error: errorText,
                webhookId
            })
            throw new Error(`Failed to delete Jira webhook: ${errorText}`)
        }

        logger.info("✅ Deleted Jira webhook", { webhookId })
    }
}

export type AtlassianToolIntegration = {
    id: string
    cloud_id: string | null
    base_url: string | null
    jira_user_email: string | null
}

export async function getAtlassianIntegrationContextForOrganization(
    integrationId: string,
    organizationId: string,
    accessTokenErrorMessage?: string
): Promise<{ accessToken: string; integration: AtlassianToolIntegration }> {
    const integration = await db().atlassian_integrations.findUnique({
        where: { id: integrationId, organization_id: organizationId },
        select: {
            id: true,
            cloud_id: true,
            base_url: true,
            jira_user_email: true
        }
    })

    if (!integration) {
        throw new Error(`Atlassian integration not found for integrationId: ${integrationId}`)
    }

    const manager = new AtlassianClient()
    const accessToken = await manager.getAccessToken(integration.id)
    if (!accessToken) {
        throw new Error(accessTokenErrorMessage ?? `Atlassian integration not found or access denied for integrationId: ${integrationId}`)
    }

    return { accessToken, integration }
}

// MARK: - Resource Fetching Functions

/**
 * Fetches Jira resources (projects) for an organization's integration.
 * Moved here from routes/jira.ts to avoid circular dependency.
 */
export async function fetchJiraResources(organizationId: string, integrationId: string) {
    const integration = await db().atlassian_integrations.findFirst({
        where: {
            id: integrationId,
            organization_id: organizationId
        }
    })

    if (!integration) {
        throw new Error("Integration not found")
    }

    if (!integration.cloud_id) {
        throw new Error("Integration missing cloud_id")
    }

    const client = new AtlassianClient()
    const accessToken = await client.getAccessToken(integrationId)
    if (!accessToken) {
        throw new Error("Could not get valid access token")
    }

    const cloudId = integration.cloud_id
    const baseUrl = integration.base_url

    let projects: Array<{
        id: string
        key: string
        name: string
        projectTypeKey: string
    }> = []

    try {
        const projectsResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json"
            }
        })

        if (projectsResponse.ok) {
            const projectsData = await projectsResponse.json()
            projects = projectsData.map((p: any) => ({
                id: p.id,
                key: p.key,
                name: p.name,
                projectTypeKey: p.projectTypeKey || "software"
            }))
        }
    } catch (error) {
        logger.warn("⚠️  Could not fetch projects:", { error })
        throw new Error("Failed to fetch projects")
    }

    return {
        success: true,
        resources: {
            projects: projects,
            baseUrl: baseUrl,
            cloudId: cloudId
        }
    }
}

/**
 * Fetches Confluence resources (pages) for an organization's integration.
 * Moved here from routes/confluence.ts to avoid circular dependency.
 */
export async function fetchConfluenceResources(organizationId: string, integrationId: string, search: string = ""): Promise<{ success: true; resources: ConfluencePage[]; total: number }> {
    if (!integrationId) {
        throw new Error("integrationId is required")
    }
    if (!organizationId) {
        throw new Error("organizationId is required")
    }

    const oauthIntegration = await db().atlassian_integrations.findFirst({
        where: {
            id: integrationId,
            organization_id: organizationId
        }
    })

    if (!oauthIntegration) {
        throw new Error("Integration not found")
    }

    const cloudId = oauthIntegration.cloud_id

    if (!cloudId) {
        throw new Error("Integration missing cloud ID")
    }

    const manager = new AtlassianClient()
    const accessToken = await manager.getAccessToken(integrationId)
    if (!accessToken) {
        throw new Error("Could not get valid access token")
    }

    // Use Confluence Search API with CQL query
    const searchUrl = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/search`
    const cql = search ? `type=page AND title ~ "${search}"` : `type=page`
    const params = new URLSearchParams({
        cql,
        limit: "100"
    })

    const searchResponse = await fetch(`${searchUrl}?${params.toString()}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json"
        }
    })

    if (!searchResponse.ok) {
        const errorText = await searchResponse.text()
        logger.error("Confluence Search API error:", {
            status: searchResponse.status,
            errorText
        })
        throw new Error(`Confluence Search API error: ${searchResponse.status} ${searchResponse.statusText} - ${errorText}`)
    }

    const searchData = (await searchResponse.json()) as ConfluenceSearchResponse
    let resources = mapSearchResultsToConfluencePages(searchData.results || [])

    if (!search) {
        resources = resources.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
    }

    return {
        success: true,
        resources,
        total: resources.length
    }
}

/**
 * Maps Confluence Search API results to ConfluencePage objects.
 * Search results contain content objects with different structure than v2 API.
 */
function mapSearchResultsToConfluencePages(results: ConfluenceSearchResult[]): ConfluencePage[] {
    return results
        .map(result => {
            const content = result.content
            if (!content || content.type !== "page") {
                return null
            }

            // Check for required fields
            const missingFields: string[] = []
            if (!content.id) missingFields.push("page id")
            if (!content.title) missingFields.push("page title")

            if (missingFields.length > 0) {
                logger.warn(`Missing fields for search result "${content.title || content.id || "unknown"}": ${missingFields.join(", ")}`)
                return null
            }

            // Extract space info from the content
            const spaceKey = content.space?.key || ""
            const spaceName = content.space?.name || spaceKey

            return {
                id: content.id,
                title: content.title,
                spaceId: spaceKey,
                spaceName: spaceName,
                url: content._links?.webui || "",
                status: content.status || "current",
                version: content.version?.number || 1
            } as ConfluencePage
        })
        .filter((page): page is ConfluencePage => page !== null)
}

// MARK: - Interfaces

// Types for Jira webhook API responses
interface JiraWebhookRegistrationResult {
    createdWebhookId?: number
    errors?: string[]
}

interface JiraWebhookRegistrationResponse {
    webhookRegistrationResult: JiraWebhookRegistrationResult[]
}

// Types for Confluence Search API responses
interface ConfluenceSearchResult {
    content?: {
        id: string
        type: string
        status?: string
        title: string
        space?: {
            key: string
            name: string
        }
        version?: {
            number: number
        }
        _links?: {
            webui?: string
        }
    }
    title?: string
    excerpt?: string
    url?: string
}

interface ConfluenceSearchResponse {
    results: ConfluenceSearchResult[]
    start?: number
    limit?: number
    size?: number
    totalSize?: number
    _links?: {
        next?: string
        self?: string
    }
}

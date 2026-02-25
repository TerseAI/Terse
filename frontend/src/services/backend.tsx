import axios from "axios"

import { POST_LOGIN_REDIRECT_KEY, isSafeRedirectPath } from "../constants/storageKeys"
import { ApiRoutes } from "../shared/ApiRoutes"
import {
    AtlassianIntegration,
    AttioIntegration,
    DatadogIntegration,
    FigmaIntegration,
    GithubIntegration,
    GmailIntegration,
    InstallationOptionsFor,
    IntegrationType,
    IntegrationWithStatus,
    LaunchDarklyIntegration,
    LinearIntegration,
    NotionIntegration,
    PosthogIntegration,
    SlackIntegration,
    WorkOSIntegration
} from "../shared/Integrations"
import { CreateNotificationDestinationRequest, NotificationDestination } from "../shared/Notifications"
import type { RunHistoryActionWithId, RunHistoryModelEvent } from "../shared/RunHistoryTypes"
import { GetAllRunHistoryResponse, GetRunHistoryParams, GetRunHistoryResponse } from "../shared/RunHistoryTypes"
import { GetToolsThatRequireApprovalsRequest, GetToolsThatRequireApprovalsResponse } from "../shared/ToolsTypes"
import {
    Agent,
    AgentTemplate,
    AgentUpdate,
    AgentsResponse,
    ApiToken,
    ApiTokenCreateResponse,
    AttioObject,
    ConfluenceResourcesResponse,
    DatadogIndexesResponse,
    GetGithubRepositoriesForIntegrationResponse,
    JiraCredentialsValidationResponse,
    JiraResourcesResponse,
    LaunchDarklyEnvironmentsResponse,
    LaunchDarklyProjectsResponse,
    LinearTeam,
    NotionResourcesResponse,
    OAuthInstallationDetails,
    PosthogProjectsResponse,
    RecentAgent,
    SlackChannelsResponse,
    SlackUsersResponse,
    StatsInterval,
    StatsResponse
} from "../shared/types"
import { User } from "../types/User"
import { deserializeConfig } from "../utility/ConfigUtils"

const backendBaseUrl = "/api"
// For browser redirects (login/logout), we need the actual backend URL since window.location.href
// bypasses Vite's proxy. Falls back to /api for production where the proxy is handled by nginx/etc.
const backendRedirectUrl = import.meta.env.VITE_BACKEND_REDIRECT_URL || "/api"
let loginRedirectInProgress = false

// Global 401 handler: when session is invalidated (e.g., user revokes session in WorkOS widget),
// redirect to login so the user gets a fresh session. The backend clears the cookie on auth failure.
axios.interceptors.response.use(
    response => response,
    error => {
        const skipAuthRedirect = error.config?.headers?.["x-skip-auth-redirect"] === "true" || error.config?.headers?.["X-Skip-Auth-Redirect"] === "true"
        if (error.response?.status === 401 && !skipAuthRedirect) {
            BackendProvider.loginRedirect()
        }
        return Promise.reject(error)
    }
)

interface BackendService {
    /**
     * Retrieves the currently authenticated user
     */
    getCurrentUser(): Promise<User>

    /**
     * Retrieves users by their IDs
     */
    getUserById(id: string): Promise<User>

    /**
     * Creates a user
     */
    createUser(name: string, email: string, password: string): Promise<User>

    /**
     * Authenticates a user with email and password
     */
    authenticateUser(email: string, password: string): Promise<User>

    /**
     * Gets statistics for the homepage dashboard
     * @param timezone - Optional IANA timezone string (e.g., "America/New_York")
     * @param interval - Optional stats interval window (e.g., "1mo")
     */
    getStats(timezone?: string, interval?: StatsInterval): Promise<StatsResponse>

    /**
     * Returns the installation details for a given integration type
     */
    getIntegrationInstallationDetails<T extends IntegrationType>(integrationType: T, options?: InstallationOptionsFor<T>, stateToken?: string): Promise<OAuthInstallationDetails>

    /**
     * Returns all integrations with their active status for the current user
     */
    getAllIntegrations(): Promise<IntegrationWithStatus[]>

    /**
     * Returns the active integrations for the current user
     */
    getActiveIntegrations(): Promise<IntegrationType[]>

    /**
     * Requests a GitHub app installation URL
     */
    requestGitHubAppInstallationUrl(): Promise<{ installationUrl: string }>

    /**
     * Gets the GitHub repositories for a specific installation
     */
    getGithubRepositoriesForIntegration(installationId: number): Promise<GetGithubRepositoriesForIntegrationResponse>

    /**
     * Gets the current Slack integration
     */
    getCurrentSlackIntegration(): Promise<SlackIntegration>

    /**
     * Gets the Jira API key
     */
    getJiraApiKey(): Promise<AtlassianIntegration>

    /**
     * Sets the Jira API key
     */
    setJiraApiKey(email: string, baseUrl: string, apiKey: string, projectKey?: string): Promise<{ success: boolean; connection?: AtlassianIntegration; error?: string }>

    /**
     * Validates Jira credentials and fetches available projects
     */
    validateJiraCredentials(baseUrl: string, email: string, apiKey: string): Promise<JiraCredentialsValidationResponse>

    /**
     * Deletes the Jira API key
     */
    deleteJiraApiKey(): Promise<void>

    /**
     * Searches Confluence pages by title (search is optional, empty returns all)
     */
    getConfluenceResources(integrationId: string, search?: string): Promise<ConfluenceResourcesResponse>

    /**
     * Gets Jira resources (projects) for a specific integration
     */
    getJiraResources(integrationId: string): Promise<JiraResourcesResponse>

    /**
     * Gets Linear teams for a specific integration
     */
    getLinearTeams(integrationId: string): Promise<LinearTeam[]>

    /**
     * Gets all Gmail integrations for the current user
     */
    getGmailIntegrations(): Promise<GmailIntegration[]>

    /**
     * Gets all Atlassian integrations for the current user
     */
    getAtlassianIntegrations(): Promise<AtlassianIntegration[]>

    /**
     * Gets all Figma integrations for the current user
     */
    getFigmaIntegrations(): Promise<FigmaIntegration[]>

    /**
     * Gets all GitHub integrations for the current user
     */
    getGithubIntegrations(): Promise<GithubIntegration[]>

    /**
     * Gets all Linear integrations for the current user
     */
    getLinearIntegrations(): Promise<LinearIntegration[]>

    /**
     * Gets all Notion integrations for the current user
     */
    getNotionIntegrations(): Promise<NotionIntegration[]>

    /**
     * Gets all Slack integrations for the current user
     */
    getSlackIntegrations(): Promise<SlackIntegration[]>

    /**
     * Deletes the Gmail integration
     */
    deleteGmailIntegration(): Promise<void>
    /**
     * Deletes the Notion integration
     */
    deleteNotionIntegration(): Promise<void>

    /**
     * Searches Notion pages and databases by title
     * @param search - optional search term, empty returns all
     * @param type - optional filter: "page" or "database"
     */
    getNotionResources(integrationId: string, search?: string, type?: "page" | "database"): Promise<NotionResourcesResponse>

    /**
     * Gets all Posthog integrations for the current user
     */
    getPosthogIntegrations(): Promise<PosthogIntegration[]>

    /**
     * Creates or updates a Posthog integration with API key
     */
    createOrUpdatePosthogIntegration(apiKey: string, stateToken?: string): Promise<{ success: boolean; email: string | null; orgName: string | null }>

    /**
     * Gets all LaunchDarkly integrations for the current user
     */
    getLaunchDarklyIntegrations(): Promise<LaunchDarklyIntegration[]>

    /**
     * Creates or updates a LaunchDarkly integration with API key
     */
    createOrUpdateLaunchDarklyIntegration(apiKey: string, stateToken?: string): Promise<{ success: boolean; email: string | null }>

    /**
     * Gets LaunchDarkly projects for an integration
     * @param integrationId - The LaunchDarkly integration ID
     */
    getLaunchDarklyProjects(integrationId: string): Promise<LaunchDarklyProjectsResponse>

    /**
     * Gets LaunchDarkly environments for a project
     * @param integrationId - The LaunchDarkly integration ID
     * @param projectKey - The LaunchDarkly project key
     */
    getLaunchDarklyEnvironments(integrationId: string, projectKey: string): Promise<LaunchDarklyEnvironmentsResponse>

    /**
     * Gets all Attio integrations for the current user
     */
    getAttioIntegrations(): Promise<AttioIntegration[]>

    /**
     * Gets available Attio objects for a specific integration
     */
    getAttioObjects(integrationId: string): Promise<AttioObject[]>

    getWorkOSIntegrations(): Promise<WorkOSIntegration[]>

    /**
     * Creates or updates a WorkOS integration with API key and optional webhook secret
     */
    createOrUpdateWorkOSIntegration(apiKey: string, webhookSecret?: string, stateToken?: string): Promise<{ integrationId: string; webhookUrl: string }>

    /**
     * Updates the webhook signing secret for an existing WorkOS integration
     */
    updateWorkOSWebhookSecret(webhookSecret: string, stateToken?: string): Promise<{ success: boolean }>

    /**
     * Gets all Datadog integrations for the current user
     */
    getDatadogIntegrations(): Promise<DatadogIntegration[]>

    /**
     * Creates or updates a Datadog integration with API key, APP key, and region
     */
    createOrUpdateDatadogIntegration(apiKey: string, appKey: string, region: string, stateToken?: string): Promise<{ success: boolean; region: string }>

    /**
     * Gets Datadog log indexes for an integration
     * @param integrationId - The Datadog integration ID
     */
    getDatadogIndexes(integrationId: string): Promise<DatadogIndexesResponse>

    /**
     * Gets Posthog projects for an integration
     * @param integrationId - The Posthog integration ID
     * @param search - Optional search term to filter projects
     */
    getPosthogProjects(integrationId: string, search?: string): Promise<PosthogProjectsResponse>

    /**
     * Gets available channels for a Slack integration
     */
    getSlackChannels(integrationId: string): Promise<SlackChannelsResponse>

    /**
     * Gets available users for a Slack integration
     */
    getSlackUsers(integrationId: string): Promise<SlackUsersResponse>

    /**
     * Requests a session socket token
     */
    requestSessionSocketToken(): Promise<string>

    /**
     * Gets all agents for the user with pagination
     */
    getUserAgents(page?: number, limit?: number, isActive?: boolean, search?: string): Promise<AgentsResponse>

    /**
     * Gets recently modified agents with last event processed time
     */
    getRecentAgents(limit?: number): Promise<RecentAgent[]>

    /**
     * Gets a single agent by ID
     */
    getAgentById(id: string): Promise<Agent>

    /**
     * Creates a new agent
     */
    createAgent(data: AgentUpdate): Promise<{ success: boolean; id: string }>

    /**
     * Updates an existing agent
     */
    updateAgent(id: string, data: AgentUpdate): Promise<{ success: boolean; id: string }>

    /**
     * Deletes an agent
     */
    deleteAgent(id: string): Promise<{ success: boolean; message: string }>

    /**
     * Fetch run history across all agents in the organization with filters and pagination
     */
    getAllRunHistory(params: GetRunHistoryParams): Promise<GetAllRunHistoryResponse>

    /**
     * Fetch run history for a specific agent with filters and pagination
     */
    getRunHistory(agentId: string, params: GetRunHistoryParams): Promise<GetRunHistoryResponse>

    /**
     * Fetch chat history for a specific run
     */
    getChatHistory(runId: string): Promise<{ events: Array<RunHistoryModelEvent>; startTimestamp?: string; endTimestamp?: string; status?: string }>

    /**
     * Fetch builder chat history for a session
     */
    getBuilderChatHistory(sessionId: string): Promise<{ events: Array<RunHistoryModelEvent>; startTimestamp: string | null; endTimestamp: string | null }>

    /**
     * Fetch run history actions by IDs
     */
    getRunHistoryActions(ids: string[]): Promise<RunHistoryActionWithId[]>

    /**
     * Gets all notification destinations for the current user
     */
    getNotificationDestinations(): Promise<NotificationDestination[]>

    /**
     * Creates a new notification destination
     */
    createNotificationDestination(destination: CreateNotificationDestinationRequest): Promise<NotificationDestination>

    /**
     * Updates an existing notification destination
     */
    updateNotificationDestination(destination: NotificationDestination): Promise<NotificationDestination>

    /**
     * Deletes a notification destination
     */
    deleteNotificationDestination(destination: NotificationDestination): Promise<void>

    /**
     * Gets all API tokens for the current user
     */
    getApiTokens(): Promise<ApiToken[]>

    /**
     * Creates a new API token
     */
    createApiToken(name: string): Promise<ApiTokenCreateResponse>

    /**
     * Updates an API token name
     */
    updateApiToken(id: string, name: string): Promise<ApiToken>

    /**
     * Deletes an API token
     */
    deleteApiToken(id: string): Promise<void>

    /**
     * Gets all available agent templates
     */
    getTemplates(): Promise<AgentTemplate[]>

    /**
     * Manually triggers a scheduled automation trigger
     * @param triggerId - The ID of the time trigger to trigger
     * @param context - Optional context explaining why the trigger is being run manually
     */
    triggerManually(triggerId: string, context?: string): Promise<{ received: boolean; message: string }>

    /**
     * Gets write-only tools that require approval for the given skills
     */
    getToolsThatRequireApprovals(request: GetToolsThatRequireApprovalsRequest): Promise<GetToolsThatRequireApprovalsResponse>

    /**
     * Redirects to the login endpoint
     */
    loginRedirect(): void

    /**
     * Redirects to the logout endpoint
     */
    logoutRedirect(): Promise<void>

    /**
     * Creates a new organization
     * Optionally updates the user's first/last name in WorkOS when provided (e.g., for users without social auth).
     */
    createOrganization(name: string, firstName?: string, lastName?: string): Promise<{ id: string; name: string }>

    /**
     * Gets the current organization
     */
    getCurrentOrganization(): Promise<{ id: string; name: string }>

    /**
     * Gets organizations the user belongs to
     */
    getUserOrganizations(): Promise<{ organizations: { id: string; name: string }[] }>

    /**
     * Switches the session to a different organization
     */
    switchOrganization(organizationId: string): Promise<{ success?: boolean; redirectUrl?: string }>

    /**
     * Gets the WorkOS widget token
     */
    getWidgetToken(): Promise<{ token: string; expiresAt: string }>

    /**
     * Gets a presigned URL for uploading an organization logo (admin only)
     */
    getOrgLogoUploadUrl(contentType: string): Promise<string>

    /**
     * Gets the logo URL for an organization
     */
    getOrgLogoUrl(organizationId: string): Promise<string | null>

    /**
     * Uploads an organization logo using presigned URL
     */
    uploadOrgLogo(file: File): Promise<void>

    /**
     * Updates organization settings (admin only)
     */
    updateOrganization(name: string): Promise<{ id: string; name: string }>
}

export const BackendProvider: BackendService = {
    getCurrentUser: () => {
        return axios
            .get<User>(`${backendBaseUrl}${ApiRoutes.AUTH.ME}`, { withCredentials: true })
            .then(response => {
                return response.data
            })
            .catch(error => {
                throw error
            })
    },

    getUserById: (id: string) => {
        return axios
            .get<User>(`${backendBaseUrl}${ApiRoutes.USERS.BY_ID.build(id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching user:", error)
                throw error
            })
    },

    createUser: (name: string, email: string, password: string) => {
        return axios
            .post(`${backendBaseUrl}${ApiRoutes.USERS.CREATE}`, { name, email, password }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating user:", error)
                throw error
            })
    },

    authenticateUser: (email: string, password: string) => {
        return axios
            .post(`${backendBaseUrl}${ApiRoutes.AUTH.LOGIN}`, { email, password }, { withCredentials: true })
            .then(response => {
                return response.data
            })
            .catch(error => {
                console.error("Error logging in:", error)
                throw error
            })
    },

    getStats: (timezone?: string, interval?: StatsInterval) => {
        const params = {
            ...(timezone ? { tz: timezone } : {}),
            ...(interval ? { interval } : {})
        }
        return axios
            .get(`${backendBaseUrl}${ApiRoutes.STATS}`, { withCredentials: true, params })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting stats:", error)
                throw error
            })
    },

    getIntegrationInstallationDetails: <T extends IntegrationType>(integrationType: T, options?: InstallationOptionsFor<T>, stateToken?: string) => {
        const params = new URLSearchParams()
        if (options) {
            params.append("options", JSON.stringify(options))
        }
        if (stateToken) {
            params.append("state", stateToken)
        }
        const queryString = params.toString()
        const url = `${backendBaseUrl}${ApiRoutes.INTEGRATIONS.INSTALLATION_DETAILS_BY_TYPE.build(integrationType)}${queryString ? `?${queryString}` : ""}`
        return axios
            .get(url, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting integration installation details:", error)
                throw error
            })
    },

    getAllIntegrations: () => {
        return axios
            .get(`${backendBaseUrl}${ApiRoutes.INTEGRATIONS.LIST}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting all integrations:", error)
                throw error
            })
    },

    getActiveIntegrations: () => {
        return axios
            .get(`${backendBaseUrl}${ApiRoutes.INTEGRATIONS.ACTIVE}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting active integrations:", error)
                throw error
            })
    },

    getGithubRepositoriesForIntegration: (installationId: number) => {
        return axios
            .get(`${backendBaseUrl}${ApiRoutes.GITHUB.GET_REPOSITORIES_FOR_INTEGRATION}`, {
                params: { installation_id: installationId },
                withCredentials: true
            })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting GitHub repositories for integration:", error)
                throw error
            })
    },

    requestGitHubAppInstallationUrl: () => {
        return axios
            .get(`${backendBaseUrl}${ApiRoutes.GITHUB.INSTALLATION_URL}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error requesting GitHub app installation URL:", error)
                throw error
            })
    },

    getCurrentSlackIntegration: () => {
        return axios
            .get(`${backendBaseUrl}${ApiRoutes.SLACK.GET_CURRENT_INTEGRATION}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting current Slack integration:", error)
                throw error
            })
    },

    getJiraApiKey: () => {
        return axios
            .get(`${backendBaseUrl}${ApiRoutes.JIRA.GET_API_KEY}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Jira API key:", error)
                throw error
            })
    },

    setJiraApiKey: (email: string, baseUrl: string, apiKey: string, projectKey?: string) => {
        return axios
            .post(`${backendBaseUrl}${ApiRoutes.JIRA.SET_API_KEY}`, { email, baseUrl, apiKey, projectKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error setting Jira API key:", error)
                const errorMessage = error.response?.data?.error || "Failed to create Jira connection"
                throw { success: false, error: errorMessage }
            })
    },

    validateJiraCredentials: (baseUrl: string, email: string, apiKey: string) => {
        return axios
            .post(`${backendBaseUrl}${ApiRoutes.JIRA.VALIDATE_AND_FETCH_PROJECTS}`, { baseUrl, email, apiKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error validating Jira credentials:", error)
                const errorMessage = error.response?.data?.error || "Failed to validate credentials"
                return { valid: false, error: errorMessage }
            })
    },

    deleteJiraApiKey: () => {
        return axios
            .delete(`${backendBaseUrl}${ApiRoutes.JIRA.DELETE_CREDENTIALS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error deleting Jira API key:", error)
                throw error
            })
    },

    getConfluenceResources: (integrationId: string, search?: string) => {
        const params = new URLSearchParams({ integrationId })
        if (search) {
            params.append("search", search)
        }
        return axios
            .get<ConfluenceResourcesResponse>(`${backendBaseUrl}${ApiRoutes.CONFLUENCE.RESOURCES}?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error searching Confluence resources:", error)
                throw error
            })
    },

    getJiraResources: (integrationId: string) => {
        return axios
            .get<JiraResourcesResponse>(`${backendBaseUrl}${ApiRoutes.JIRA.RESOURCES}?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching Jira resources:", error)
                throw error
            })
    },

    getLinearTeams: (integrationId: string) => {
        return axios
            .get<LinearTeam[]>(`${backendBaseUrl}${ApiRoutes.LINEAR.TEAMS}?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching Linear teams:", error)
                throw error
            })
    },

    getGmailIntegrations: () => {
        return axios
            .get<GmailIntegration[]>(`${backendBaseUrl}${ApiRoutes.GMAIL.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Gmail integrations:", error)
                throw error
            })
    },

    getAtlassianIntegrations: () => {
        return axios
            .get<AtlassianIntegration[]>(`${backendBaseUrl}${ApiRoutes.ATLASSIAN.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Atlassian integrations:", error)
                throw error
            })
    },

    getFigmaIntegrations: () => {
        return axios
            .get<FigmaIntegration[]>(`${backendBaseUrl}${ApiRoutes.FIGMA.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Figma integrations:", error)
                throw error
            })
    },

    getGithubIntegrations: () => {
        return axios
            .get<GithubIntegration[]>(`${backendBaseUrl}${ApiRoutes.GITHUB.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting GitHub integrations:", error)
                throw error
            })
    },

    getLinearIntegrations: () => {
        return axios
            .get<LinearIntegration[]>(`${backendBaseUrl}${ApiRoutes.LINEAR.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Linear integrations:", error)
                throw error
            })
    },

    getNotionIntegrations: () => {
        return axios
            .get<NotionIntegration[]>(`${backendBaseUrl}${ApiRoutes.NOTION.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Notion integrations:", error)
                throw error
            })
    },

    getPosthogIntegrations: () => {
        return axios
            .get<PosthogIntegration[]>(`${backendBaseUrl}${ApiRoutes.POSTHOG.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Posthog integrations:", error)
                throw error
            })
    },

    createOrUpdatePosthogIntegration: (apiKey: string, stateToken?: string) => {
        const body: any = { apiKey }
        if (stateToken) {
            body.state = stateToken
        }
        return axios
            .post<{ success: boolean; email: string | null; orgName: string | null }>(`${backendBaseUrl}${ApiRoutes.POSTHOG.INTEGRATIONS}`, body, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating/updating Posthog integration:", error)
                throw error
            })
    },

    getLaunchDarklyIntegrations: () => {
        return axios
            .get<LaunchDarklyIntegration[]>(`${backendBaseUrl}${ApiRoutes.LAUNCHDARKLY.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting LaunchDarkly integrations:", error)
                throw error
            })
    },

    getAttioIntegrations: () => {
        return axios
            .get<AttioIntegration[]>(`${backendBaseUrl}${ApiRoutes.ATTIO.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Attio integrations:", error)
                throw error
            })
    },

    getAttioObjects: (integrationId: string) => {
        return axios
            .get<AttioObject[]>(`${backendBaseUrl}${ApiRoutes.ATTIO.OBJECTS.build(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Attio objects:", error)
                throw error
            })
    },

    getWorkOSIntegrations: () => {
        return axios
            .get<WorkOSIntegration[]>(`${backendBaseUrl}${ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting WorkOS integrations:", error)
                throw error
            })
    },

    createOrUpdateWorkOSIntegration: (apiKey: string, webhookSecret?: string, stateToken?: string) => {
        const body: any = { apiKey }
        if (webhookSecret) {
            body.webhookSecret = webhookSecret
        }
        if (stateToken) {
            body.state = stateToken
        }
        return axios
            .post<{ integrationId: string; webhookUrl: string }>(`${backendBaseUrl}${ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS}`, body, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating/updating WorkOS integration:", error)
                throw error
            })
    },

    updateWorkOSWebhookSecret: (webhookSecret: string, stateToken?: string) => {
        const body: Record<string, string> = { webhookSecret }
        if (stateToken) {
            body.state = stateToken
        }
        return axios
            .patch<{ success: boolean }>(`${backendBaseUrl}${ApiRoutes.WORKOS_INTEGRATION.WEBHOOK_SECRET}`, body, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error updating WorkOS webhook secret:", error)
                throw error
            })
    },

    getDatadogIntegrations: () => {
        return axios
            .get<DatadogIntegration[]>(`${backendBaseUrl}${ApiRoutes.DATADOG.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Datadog integrations:", error)
                throw error
            })
    },

    createOrUpdateLaunchDarklyIntegration: (apiKey: string, stateToken?: string) => {
        const body: any = { apiKey }
        if (stateToken) {
            body.state = stateToken
        }
        return axios
            .post<{ success: boolean; email: string | null }>(`${backendBaseUrl}${ApiRoutes.LAUNCHDARKLY.INTEGRATIONS}`, body, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating/updating LaunchDarkly integration:", error)
                throw error
            })
    },

    createOrUpdateDatadogIntegration: (apiKey: string, appKey: string, region: string, stateToken?: string) => {
        const body: any = { apiKey, appKey, region }
        if (stateToken) {
            body.state = stateToken
        }
        return axios
            .post<{ success: boolean; region: string }>(`${backendBaseUrl}${ApiRoutes.DATADOG.INTEGRATIONS}`, body, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating/updating Datadog integration:", error)
                throw error
            })
    },

    getLaunchDarklyProjects: (integrationId: string) => {
        return axios
            .get<LaunchDarklyProjectsResponse>(`${backendBaseUrl}${ApiRoutes.LAUNCHDARKLY.PROJECTS_BY_INTEGRATION_ID.build(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching LaunchDarkly projects:", error)
                throw error
            })
    },

    getLaunchDarklyEnvironments: (integrationId: string, projectKey: string) => {
        return axios
            .get<LaunchDarklyEnvironmentsResponse>(`${backendBaseUrl}${ApiRoutes.LAUNCHDARKLY.ENVIRONMENTS_BY_INTEGRATION_AND_PROJECT.build(integrationId, projectKey)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching LaunchDarkly environments:", error)
                throw error
            })
    },

    getDatadogIndexes: (integrationId: string) => {
        return axios
            .get<DatadogIndexesResponse>(`${backendBaseUrl}/datadog/indexes`, {
                params: { integrationId },
                withCredentials: true
            })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Datadog indexes:", error)
                throw error
            })
    },

    getPosthogProjects: (integrationId: string, search?: string) => {
        const params = new URLSearchParams({ integrationId })
        if (search) {
            params.append("search", search)
        }
        return axios
            .get<PosthogProjectsResponse>(`${backendBaseUrl}${ApiRoutes.POSTHOG.PROJECTS}?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching Posthog projects:", error)
                throw error
            })
    },

    getSlackIntegrations: () => {
        return axios
            .get<SlackIntegration[]>(`${backendBaseUrl}${ApiRoutes.SLACK.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Slack integrations:", error)
                throw error
            })
    },

    deleteGmailIntegration: () => {
        return axios
            .delete(`${backendBaseUrl}/gmail/delete-integration`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error deleting Gmail integration:", error)
                throw error
            })
    },

    deleteNotionIntegration: () => {
        return axios
            .delete(`${backendBaseUrl}${ApiRoutes.NOTION.DELETE_INTEGRATION}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error deleting Notion integration:", error)
                throw error
            })
    },

    getNotionResources: (integrationId: string, search?: string, type?: "page" | "database") => {
        const params = new URLSearchParams({ integrationId })
        if (search) {
            params.append("search", search)
        }
        if (type) {
            params.append("type", type)
        }
        return axios
            .get<NotionResourcesResponse>(`${backendBaseUrl}${ApiRoutes.NOTION.RESOURCES}?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error searching Notion resources:", error)
                throw error
            })
    },

    getSlackChannels: (integrationId: string) => {
        return axios
            .get<SlackChannelsResponse>(`${backendBaseUrl}${ApiRoutes.SLACK.CHANNELS}?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching Slack channels:", error)
                throw error
            })
    },

    getSlackUsers: (integrationId: string) => {
        return axios
            .get<SlackUsersResponse>(`${backendBaseUrl}${ApiRoutes.SLACK.USERS}?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching Slack users:", error)
                throw error
            })
    },

    requestSessionSocketToken: () => {
        return axios
            .get<{ token: string } | string>(`${backendBaseUrl}${ApiRoutes.SESSION.TOKEN}`, { withCredentials: true })
            .then(response => {
                const data = response.data
                return typeof data === "string" ? data : data.token
            })
            .catch(error => {
                console.error("Error requesting session socket token:", error)
                throw error
            })
    },

    getUserAgents: (page = 1, limit = 10, isActive?: boolean, search?: string) => {
        const params = new URLSearchParams()
        params.append("page", page.toString())
        params.append("pageSize", limit.toString())
        if (isActive !== undefined) {
            params.append("isActive", isActive.toString())
        }
        if (search) {
            params.append("search", search)
        }

        return axios
            .get<AgentsResponse>(`${backendBaseUrl}${ApiRoutes.AGENTS.LIST}?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting agents:", error)
                throw error
            })
    },

    getRecentAgents: (limit = 3) => {
        const params = new URLSearchParams()
        params.append("limit", limit.toString())

        return axios
            .get<RecentAgent[]>(`${backendBaseUrl}${ApiRoutes.AGENTS.RECENT}?${params.toString()}`, { withCredentials: true })
            .then(response => {
                // Deserialize configs from JSON to class instances
                return response.data.map(agent => ({
                    ...agent,
                    triggers: agent.triggers.map(trigger => ({
                        ...trigger,
                        config: deserializeConfig(trigger.config)
                    })),
                    outputs: agent.outputs
                        ? agent.outputs.map(output => ({
                              ...output,
                              config: deserializeConfig(output.config)
                          }))
                        : []
                }))
            })
            .catch(error => {
                console.error("Error getting recent agents:", error)
                throw error
            })
    },

    getAgentById: (id: string) => {
        return axios
            .get<Agent>(`${backendBaseUrl}${ApiRoutes.AGENTS.BY_ID.build(id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting agent:", error)
                throw error
            })
    },

    createAgent: (data: Agent) => {
        return axios
            .post<{ success: boolean; id: string }>(`${backendBaseUrl}${ApiRoutes.AGENTS.LIST}`, data, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating agent:", error)
                throw error
            })
    },

    updateAgent: (id: string, data: AgentUpdate) => {
        return axios
            .patch<{ success: boolean; id: string }>(`${backendBaseUrl}${ApiRoutes.AGENTS.BY_ID.build(id)}`, data, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error updating agent:", error)
                throw error
            })
    },

    deleteAgent: (id: string) => {
        return axios
            .delete<{ success: boolean; message: string }>(`${backendBaseUrl}${ApiRoutes.AGENTS.BY_ID.build(id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error deleting agent:", error)
                throw error
            })
    },

    getAllRunHistory: params => {
        const usp = new URLSearchParams()
        if (params.page) usp.append("page", String(params.page))
        if (params.pageSize) usp.append("pageSize", String(params.pageSize))
        if (params.q) usp.append("q", params.q)
        if (params.start) usp.append("start", params.start)
        if (params.end) usp.append("end", params.end)
        if (params.status && params.status.length) usp.append("status", params.status.join(","))
        const url = `${backendBaseUrl}${ApiRoutes.RUN_HISTORY.ALL}${usp.toString() ? `?${usp.toString()}` : ""}`
        return axios
            .get<GetAllRunHistoryResponse>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error("Error fetching all run history:", error)
                throw error
            })
    },

    getRunHistory: (agentId, params) => {
        const usp = new URLSearchParams()
        if (params.page) usp.append("page", String(params.page))
        if (params.pageSize) usp.append("pageSize", String(params.pageSize))
        if (params.q) usp.append("q", params.q)
        if (params.start) usp.append("start", params.start)
        if (params.end) usp.append("end", params.end)
        if (params.status && params.status.length) usp.append("status", params.status.join(","))
        const url = `${backendBaseUrl}${ApiRoutes.RUN_HISTORY.BY_AGENT_ID.build(agentId)}${usp.toString() ? `?${usp.toString()}` : ""}`
        return axios
            .get<GetRunHistoryResponse>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error("Error fetching run history:", error)
                throw error
            })
    },

    getChatHistory: runId => {
        const url = `${backendBaseUrl}${ApiRoutes.RUN_HISTORY.CHAT_BY_RUN_ID.build(runId)}`
        return axios
            .get<{ events: Array<RunHistoryModelEvent>; startTimestamp?: string; endTimestamp?: string; status?: string }>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error("Error fetching chat history:", error)
                throw error
            })
    },

    getBuilderChatHistory: sessionId => {
        const url = `${backendBaseUrl}${ApiRoutes.BUILDER_CHAT.HISTORY_BY_SESSION_ID.build(sessionId)}`
        return axios
            .get<{ events: Array<RunHistoryModelEvent>; startTimestamp: string | null; endTimestamp: string | null }>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error("Error fetching builder chat history:", error)
                throw error
            })
    },

    getRunHistoryActions: ids => {
        const usp = new URLSearchParams()
        usp.append("ids", ids.join(","))
        const url = `${backendBaseUrl}${ApiRoutes.RUN_HISTORY.ACTIONS}?${usp.toString()}`
        return axios
            .get<RunHistoryActionWithId[]>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error("Error fetching run history actions:", error)
                throw error
            })
    },

    getNotificationDestinations: () => {
        return axios
            .get<NotificationDestination[]>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_DESTINATIONS.LIST}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting notification destinations:", error)
                throw error
            })
    },

    createNotificationDestination: (destination: CreateNotificationDestinationRequest) => {
        return axios
            .post<NotificationDestination>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_DESTINATIONS.LIST}`, destination, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating notification destination:", error)
                throw error
            })
    },

    updateNotificationDestination: (destination: NotificationDestination) => {
        return axios
            .put<NotificationDestination>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID.build(destination.id)}`, destination, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error updating notification destination:", error)
                throw error
            })
    },

    deleteNotificationDestination: (destination: NotificationDestination) => {
        return axios
            .delete<void>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID.build(destination.id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error deleting notification destination:", error)
                throw error
            })
    },

    getApiTokens: () => {
        return axios
            .get<ApiToken[]>(`${backendBaseUrl}${ApiRoutes.API_TOKENS.LIST}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting API tokens:", error)
                throw error
            })
    },

    createApiToken: (name: string) => {
        return axios
            .post<ApiTokenCreateResponse>(`${backendBaseUrl}${ApiRoutes.API_TOKENS.LIST}`, { name }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating API token:", error)
                throw error
            })
    },

    updateApiToken: (id: string, name: string) => {
        return axios
            .patch<ApiToken>(`${backendBaseUrl}${ApiRoutes.API_TOKENS.BY_ID.build(id)}`, { name }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error updating API token:", error)
                throw error
            })
    },

    deleteApiToken: (id: string) => {
        return axios
            .delete<void>(`${backendBaseUrl}${ApiRoutes.API_TOKENS.BY_ID.build(id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error deleting API token:", error)
                throw error
            })
    },

    getTemplates: () => {
        return axios
            .get<AgentTemplate[]>(`${backendBaseUrl}${ApiRoutes.TEMPLATES}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting templates:", error)
                throw error
            })
    },

    triggerManually: (triggerId: string, context?: string) => {
        return axios
            .post<{ received: boolean; message: string }>(`${backendBaseUrl}${ApiRoutes.SCHEDULE.TRIGGER_BY_INPUT_ID.build(triggerId)}`, { context }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error triggering manually:", error)
                throw error
            })
    },

    getToolsThatRequireApprovals: (request: GetToolsThatRequireApprovalsRequest) => {
        return axios
            .post<GetToolsThatRequireApprovalsResponse>(`${backendBaseUrl}${ApiRoutes.TOOLS.THAT_REQUIRE_APPROVALS}`, request, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting tools that require approvals:", error)
                throw error
            })
    },

    loginRedirect: () => {
        if (loginRedirectInProgress) {
            return
        }
        loginRedirectInProgress = true

        try {
            const { pathname, search, hash } = window.location
            const redirectPath = `${pathname}${search}${hash}`.replace(/#$/, "")

            if (redirectPath && redirectPath !== "/" && redirectPath !== "/app" && isSafeRedirectPath(redirectPath)) {
                localStorage.setItem(POST_LOGIN_REDIRECT_KEY, redirectPath)
            } else {
                localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
            }
        } catch (error) {
            console.error("Failed to store post-login redirect", error)
        }

        const LOGIN_URL_TIMEOUT_MS = 15_000

        void axios
            .get<{ loginUrl: string }>(`${backendBaseUrl}${ApiRoutes.AUTH.LOGIN_URL}`, {
                withCredentials: true,
                headers: { "x-skip-auth-redirect": "true" },
                timeout: LOGIN_URL_TIMEOUT_MS
            })
            .then(response => {
                const loginUrl = response.data?.loginUrl
                if (typeof loginUrl === "string" && loginUrl.length > 0) {
                    window.location.href = loginUrl
                } else {
                    window.location.href = `${backendRedirectUrl}${ApiRoutes.AUTH.LOGIN}`
                }
            })
            .catch(error => {
                console.error("Error getting WorkOS login URL, falling back to backend login endpoint:", error)
                window.location.href = `${backendRedirectUrl}${ApiRoutes.AUTH.LOGIN}`
            })
            .finally(() => {
                loginRedirectInProgress = false
            })
    },

    logoutRedirect: async () => {
        const redirectToLoginQuery = "redirectToLogin=true"
        try {
            const response = await axios.get<{ logoutUrl: string }>(`${backendBaseUrl}${ApiRoutes.AUTH.LOGOUT_URL}?${redirectToLoginQuery}`, { withCredentials: true })
            window.location.href = response.data.logoutUrl
        } catch (error) {
            console.error("Error getting WorkOS logout URL, falling back to backend logout endpoint:", error)
            window.location.href = `${backendRedirectUrl}${ApiRoutes.AUTH.LOGOUT}?${redirectToLoginQuery}`
        }
    },

    createOrganization: (name: string, firstName?: string, lastName?: string) => {
        return axios
            .post<{ id: string; name: string }>(`${backendBaseUrl}${ApiRoutes.ORGANIZATIONS.CREATE}`, { name, firstName, lastName }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating organization:", error)
                throw error
            })
    },

    getCurrentOrganization: () => {
        return axios
            .get<{ id: string; name: string }>(`${backendBaseUrl}${ApiRoutes.ORGANIZATIONS.GET_CURRENT}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting current organization:", error)
                throw error
            })
    },

    getUserOrganizations: () => {
        return axios
            .get<{ organizations: { id: string; name: string }[] }>(`${backendBaseUrl}${ApiRoutes.ORGANIZATIONS.LIST}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting user organizations:", error)
                throw error
            })
    },

    switchOrganization: (organizationId: string) => {
        return axios
            .post<{ success?: boolean; redirectUrl?: string }>(`${backendBaseUrl}${ApiRoutes.ORGANIZATIONS.SWITCH}`, { organizationId }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                const data = error.response?.data
                if (data?.redirectUrl) {
                    return Promise.reject({ ...error, redirectUrl: data.redirectUrl })
                }
                console.error("Error switching organization:", error)
                throw error
            })
    },

    getWidgetToken: () => {
        return axios
            .get<{ token: string; expiresAt: string }>(`${backendBaseUrl}${ApiRoutes.WORKOS.WIDGET_TOKEN}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting widget token:", error)
                throw error
            })
    },

    getOrgLogoUploadUrl: (contentType: string) => {
        return axios
            .get<{ uploadUrl: string }>(`${backendBaseUrl}${ApiRoutes.ORGANIZATIONS.LOGO_UPLOAD_URL}`, {
                params: { contentType },
                withCredentials: true
            })
            .then(response => response.data.uploadUrl)
            .catch(error => {
                console.error("Error getting logo upload URL:", error)
                throw error
            })
    },

    getOrgLogoUrl: (organizationId: string) => {
        return axios
            .get<{ logoUrl: string | null }>(`${backendBaseUrl}${ApiRoutes.ORGANIZATIONS.LOGO.build(organizationId)}`, { withCredentials: true })
            .then(response => response.data.logoUrl)
            .catch(error => {
                console.error("Error getting logo URL:", error)
                throw error
            })
    },

    uploadOrgLogo: async (file: File) => {
        const contentType = file.type
        const uploadUrl = await BackendProvider.getOrgLogoUploadUrl(contentType)

        await axios.put(uploadUrl, file, {
            headers: {
                "Content-Type": contentType
            }
        })
    },

    updateOrganization: (name: string) => {
        return axios
            .put<{ id: string; name: string }>(`${backendBaseUrl}${ApiRoutes.ORGANIZATIONS.UPDATE}`, { name }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error updating organization:", error)
                throw error
            })
    }
}

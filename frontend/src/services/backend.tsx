import axios from "axios"
import { ApiRoutes, buildRoute } from "terse-types"
import type { SdkSampleEventRef as SampleEventRef, SerializedEvent } from "terse-types"
import { BalanceSummary, BillingChangeResponse, BillingPeriod, BillingStripeRedirectResponse, OverageMode, PlanKey, SetOverageModeResponse, UsageResponse } from "terse-types"
import { ApprovalRequestFilter, GetPendingApprovalsResponse } from "terse-types/ApprovalTypes"
import {
    AttioIntegration,
    DatadogIntegration,
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
    SnowflakeIntegration,
    WorkOSIntegration
} from "terse-types/Integrations"
import { CreateNotificationDestinationRequest, NotificationDestination, NotificationSettings, UpdateNotificationSettingsRequest } from "terse-types/Notifications"
import type { RunHistoryActionType, RunHistoryActionWithId, RunHistoryModelEvent } from "terse-types/RunHistoryTypes"
import { GetAllRunHistoryResponse, GetRunHistoryParams, GetRunHistoryResponse, RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { GetSentNotificationsResponse } from "terse-types/SentNotifications"
import { GetToolsThatRequireApprovalsRequest, GetToolsThatRequireApprovalsResponse } from "terse-types/ToolsTypes"
import {
    Agent,
    AgentFileContentResponse,
    AgentFilesResponse,
    AgentTemplate,
    type AgentTrigger,
    AgentUpdate,
    AgentsResponse,
    ApiToken,
    ApiTokenCreateResponse,
    ApplyImprovementResponse,
    AttioObjectWithAttributes,
    DatadogIndexesResponse,
    DismissImprovementResponse,
    GetAgentImprovementsResponse,
    GetGithubRepositoriesForIntegrationResponse,
    LaunchDarklyEnvironmentsResponse,
    LaunchDarklyProjectsResponse,
    LinearTeam,
    NotionResourcesResponse,
    OAuthInstallationDetails,
    PosthogProjectsResponse,
    ProjectDeploysResponse,
    ProjectDetailResponse,
    ProjectSourceFilesResponse,
    RecentAgent,
    SdkJobServerCheckResponse,
    SlackChannelsResponse,
    SlackUsersResponse,
    StatsInterval,
    StatsResponse,
    ToggleImprovementsEnabledResponse
} from "terse-types/types"

import { POST_LOGIN_REDIRECT_KEY, isSafeRedirectPath } from "../constants/storageKeys"
import { User } from "../types/User"

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
     * Gets Linear teams for a specific integration
     */
    getLinearTeams(integrationId: string): Promise<LinearTeam[]>

    /**
     * Gets all Gmail integrations for the current user
     */
    getGmailIntegrations(): Promise<GmailIntegration[]>

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
    getAttioObjects(integrationId: string): Promise<AttioObjectWithAttributes[]>

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
     * Fetches the detail view for a single project.
     */
    getProjectById(id: string): Promise<ProjectDetailResponse>

    /**
     * Deletes a project and all its jobs. Throws if the project has in-flight runs.
     */
    deleteProject(id: string): Promise<void>

    /**
     * Lists the most recent deploys for a project, newest first.
     */
    getProjectDeploys(id: string): Promise<ProjectDeploysResponse>

    /**
     * Lists the source files of a project's currently-active deploy.
     */
    getProjectSourceFiles(id: string): Promise<ProjectSourceFilesResponse>

    /**
     * Returns the raw bytes (base64) of a single file from the project's active deploy archive.
     */
    getProjectSourceFileContent(id: string, fileId: string): Promise<AgentFileContentResponse>

    /**
     * Verifies that a self-hosted SDK job server is reachable and correctly configured
     */
    verifySdkJobServer(agentId: string): Promise<SdkJobServerCheckResponse>

    /**
     * Gets the latest review and improvements for an agent
     */
    getAgentImprovements(agentId: string): Promise<GetAgentImprovementsResponse>

    /**
     * Marks a pending improvement as applied and returns the prefill prompt
     */
    applyImprovement(agentId: string, improvementId: string): Promise<ApplyImprovementResponse>

    /**
     * Marks a pending improvement as dismissed
     */
    dismissImprovement(agentId: string, improvementId: string): Promise<DismissImprovementResponse>

    /**
     * Reverts a dismissed improvement back to pending
     */
    undoDismissImprovement(agentId: string, improvementId: string): Promise<{ success: boolean }>

    /**
     * Toggles whether weekly improvements are enabled for an agent
     */
    toggleImprovementsEnabled(agentId: string, enabled: boolean): Promise<ToggleImprovementsEnabledResponse>

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
    getChatHistory(runId: string): Promise<{
        events: Array<RunHistoryModelEvent>
        startTimestamp?: string
        endTimestamp?: string
        status?: RunHistoryStatus
        triggerEvent?: string | null
        triggerEventType?: string | null
        isTriggerEventTruncated?: boolean
    }>

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
     * Gets sent notifications for the current organization
     */
    getSentNotifications(params: { page?: number; pageSize?: number }): Promise<GetSentNotificationsResponse>

    /**
     * Gets pending approval requests for the current organization
     */
    getPendingApprovals(params?: { status?: ApprovalRequestFilter }): Promise<GetPendingApprovalsResponse>

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
     * Fetches sample events for the given triggers (e.g. GitHub push/PR events)
     */
    fetchSampleEvents(triggers: Array<{ triggerId?: string; integrationId: string; integrationType: IntegrationType; config: AgentTrigger["config"] }>): Promise<{ events: SampleEventRef[] }>
    hydrateSampleEvent(entityType: string, entityId: string): Promise<{ event: SerializedEvent }>

    /**
     * Triggers an automation with a specific event payload (e.g. a sample event)
     *
     * Exactly one of `event` or `runId` must be supplied. The overloads enforce this at
     * compile time so the request body can never serialize to `{}` and fail backend
     * Zod union validation with a 400 error.
     */
    triggerWithEvent(automationId: string, event: SerializedEvent, runId?: undefined): Promise<{ received: boolean; message: string }>
    triggerWithEvent(automationId: string, event: undefined, runId: string): Promise<{ received: boolean; message: string }>

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

    /**
     * Gets user-level notification topic settings
     */
    getNotificationSettings(): Promise<NotificationSettings>

    /**
     * Updates user-level notification topic settings
     */
    updateNotificationSettings(agentDefaultNotifications: RunHistoryActionType[], weeklyAgentImprovements: boolean, applyToAllAgents?: boolean): Promise<void>

    /**
     * Gets all Snowflake integrations for the current user
     */
    getSnowflakeIntegrations(): Promise<SnowflakeIntegration[]>

    /**
     * Creates or updates a Snowflake integration
     */
    createOrUpdateSnowflakeIntegration(
        accountIdentifier: string,
        username: string,
        privateKey: string,
        passphrase: string,
        warehouse: string,
        stateToken?: string
    ): Promise<{ success: boolean; accountIdentifier: string; warehouse: string }>

    /**
     * Lists out the files uploaded to an agent
     */
    getAgentFiles(agentId: string): Promise<AgentFilesResponse>

    /**
     * Gets the content of a file uploaded to an agent as a presigend URL
     */
    getAgentFileContent(agentId: string, fileId: string): Promise<AgentFileContentResponse>

    getBalance(): Promise<BalanceSummary>
    getUsage(params?: { start?: Date; end?: Date }): Promise<UsageResponse>
    createCheckoutForPlan(planKey: PlanKey, period: BillingPeriod): Promise<BillingStripeRedirectResponse>
    createCheckoutForTopup(packCredits: number): Promise<BillingStripeRedirectResponse>
    changeBillingSubscription(input: { kind: "cancel_to_free" } | { kind: "change_period"; planKey: PlanKey; period: BillingPeriod }): Promise<BillingChangeResponse>
    createPortalSession(): Promise<BillingStripeRedirectResponse>
    setOverageMode(mode: OverageMode): Promise<SetOverageModeResponse>
}

export const BackendProvider: BackendService = {
    getCurrentUser: () => {
        const skipAuthRedirect = window.location.pathname === "/pricing"
        return axios
            .get<User>(`${backendBaseUrl}${ApiRoutes.AUTH.ME}`, {
                withCredentials: true,
                ...(skipAuthRedirect ? { headers: { "x-skip-auth-redirect": "true" } } : {})
            })
            .then(response => {
                return response.data
            })
            .catch(error => {
                throw error
            })
    },

    getUserById: (id: string) => {
        const url = buildRoute(ApiRoutes.USERS.BY_ID, { id })
        return axios
            .get<User>(`${backendBaseUrl}${url}`, { withCredentials: true })
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
        const apiUrl = buildRoute(ApiRoutes.INTEGRATIONS.INSTALLATION_DETAILS_BY_TYPE, { integrationType })
        const url = `${backendBaseUrl}${apiUrl}${queryString ? `?${queryString}` : ""}`
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
        const url = buildRoute(ApiRoutes.ATTIO.OBJECTS, { integrationId })
        return axios
            .get<AttioObjectWithAttributes[]>(`${backendBaseUrl}${url}`, { withCredentials: true })
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
        const url = buildRoute(ApiRoutes.LAUNCHDARKLY.PROJECTS_BY_INTEGRATION_ID, { integrationId })
        return axios
            .get<LaunchDarklyProjectsResponse>(`${backendBaseUrl}${url}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching LaunchDarkly projects:", error)
                throw error
            })
    },

    getLaunchDarklyEnvironments: (integrationId: string, projectKey: string) => {
        const url = buildRoute(ApiRoutes.LAUNCHDARKLY.ENVIRONMENTS_BY_INTEGRATION_AND_PROJECT, { integrationId, projectKey })
        return axios
            .get<LaunchDarklyEnvironmentsResponse>(`${backendBaseUrl}${url}`, { withCredentials: true })
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

    getSnowflakeIntegrations: () => {
        return axios
            .get<SnowflakeIntegration[]>(`${backendBaseUrl}${ApiRoutes.SNOWFLAKE.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting Snowflake integrations:", error)
                throw error
            })
    },

    createOrUpdateSnowflakeIntegration: (accountIdentifier: string, username: string, privateKey: string, passphrase: string, warehouse: string, stateToken?: string) => {
        const body: any = { accountIdentifier, username, privateKey, passphrase, warehouse }
        if (stateToken) {
            body.state = stateToken
        }
        return axios
            .post<{ success: boolean; accountIdentifier: string; warehouse: string }>(`${backendBaseUrl}${ApiRoutes.SNOWFLAKE.INTEGRATIONS}`, body, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating/updating Snowflake integration:", error)
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
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting recent agents:", error)
                throw error
            })
    },

    getAgentById: (id: string) => {
        const url = buildRoute(ApiRoutes.AGENTS.BY_ID, { id })
        return axios
            .get<Agent>(`${backendBaseUrl}${url}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting agent:", error)
                throw error
            })
    },

    getProjectById: (id: string) => {
        const url = buildRoute(ApiRoutes.PROJECTS.BY_ID, { id })
        return axios
            .get<ProjectDetailResponse>(`${backendBaseUrl}${url}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting project:", error)
                throw error
            })
    },

    deleteProject: (id: string) => {
        const url = buildRoute(ApiRoutes.PROJECTS.BY_ID, { id })
        return axios.delete<void>(`${backendBaseUrl}${url}`, { withCredentials: true }).then(() => undefined)
    },

    getProjectDeploys: (id: string) => {
        const url = buildRoute(ApiRoutes.PROJECTS.DEPLOYS, { id })
        return axios
            .get<ProjectDeploysResponse>(`${backendBaseUrl}${url}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting project deploys:", error)
                throw error
            })
    },

    getProjectSourceFiles: (id: string) => {
        const url = buildRoute(ApiRoutes.PROJECTS.SOURCE_FILES, { id })
        return axios
            .get<ProjectSourceFilesResponse>(`${backendBaseUrl}${url}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting project source files:", error)
                throw error
            })
    },

    getProjectSourceFileContent: (id: string, fileId: string) => {
        const url = buildRoute(ApiRoutes.PROJECTS.SOURCE_FILE_CONTENT, { id, fileId })
        return axios
            .get<AgentFileContentResponse>(`${backendBaseUrl}${url}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting project source file content:", error)
                throw error
            })
    },

    verifySdkJobServer: (agentId: string) => {
        const url = buildRoute(ApiRoutes.SDK.VERIFY_JOB_SERVER, { agentId })
        return axios
            .post<SdkJobServerCheckResponse>(`${backendBaseUrl}${url}`, undefined, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error verifying SDK job server:", error)
                throw error
            })
    },

    getAgentImprovements: (agentId: string) => {
        const url = buildRoute(ApiRoutes.IMPROVEMENTS.BY_AGENT_ID, { agentId })
        return axios
            .get<GetAgentImprovementsResponse>(`${backendBaseUrl}${url}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting agent improvements:", error)
                throw error
            })
    },

    applyImprovement: (agentId: string, improvementId: string) => {
        const url = buildRoute(ApiRoutes.IMPROVEMENTS.APPLY, { agentId, id: improvementId })
        return axios
            .post<ApplyImprovementResponse>(`${backendBaseUrl}${url}`, {}, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error applying improvement:", error)
                throw error
            })
    },

    dismissImprovement: (agentId: string, improvementId: string) => {
        const url = buildRoute(ApiRoutes.IMPROVEMENTS.DISMISS, { agentId, id: improvementId })
        return axios
            .post<DismissImprovementResponse>(`${backendBaseUrl}${url}`, {}, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error dismissing improvement:", error)
                throw error
            })
    },

    undoDismissImprovement: (agentId: string, improvementId: string) => {
        const url = buildRoute(ApiRoutes.IMPROVEMENTS.UNDO_DISMISS, { agentId, id: improvementId })
        return axios
            .post<{ success: boolean }>(`${backendBaseUrl}${url}`, {}, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error undoing dismiss:", error)
                throw error
            })
    },

    toggleImprovementsEnabled: (agentId: string, enabled: boolean) => {
        const url = buildRoute(ApiRoutes.IMPROVEMENTS.TOGGLE_ENABLED, { agentId })
        return axios
            .patch<ToggleImprovementsEnabledResponse>(`${backendBaseUrl}${url}`, { enabled }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error toggling improvements setting:", error)
                throw error
            })
    },

    createAgent: (data: AgentUpdate) => {
        return axios
            .post<{ success: boolean; id: string }>(`${backendBaseUrl}${ApiRoutes.AGENTS.LIST}`, data, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error creating agent:", error)
                throw error
            })
    },

    updateAgent: (id: string, data: AgentUpdate) => {
        const url = buildRoute(ApiRoutes.AGENTS.BY_ID, { id })
        return axios
            .patch<{ success: boolean; id: string }>(`${backendBaseUrl}${url}`, data, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error updating agent:", error)
                throw error
            })
    },

    deleteAgent: (id: string) => {
        const url = buildRoute(ApiRoutes.AGENTS.BY_ID, { id })
        return axios
            .delete<{ success: boolean; message: string }>(`${backendBaseUrl}${url}`, { withCredentials: true })
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
        const apiUrl = buildRoute(ApiRoutes.RUN_HISTORY.BY_AGENT_ID, { agentId })
        const url = `${backendBaseUrl}${apiUrl}${usp.toString() ? `?${usp.toString()}` : ""}`
        return axios
            .get<GetRunHistoryResponse>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error("Error fetching run history:", error)
                throw error
            })
    },

    getChatHistory: runId => {
        const apiUrl = buildRoute(ApiRoutes.RUN_HISTORY.CHAT_BY_RUN_ID, { runId })
        const url = `${backendBaseUrl}${apiUrl}`
        return axios
            .get<{
                events: Array<RunHistoryModelEvent>
                startTimestamp?: string
                endTimestamp?: string
                status?: RunHistoryStatus
                triggerEvent?: string | null
                triggerEventType?: string | null
                isTriggerEventTruncated?: boolean
            }>(url, {
                withCredentials: true
            })
            .then(r => r.data)
            .catch(error => {
                console.error("Error fetching chat history:", error)
                throw error
            })
    },

    getBuilderChatHistory: sessionId => {
        const apiUrl = buildRoute(ApiRoutes.BUILDER_CHAT.HISTORY_BY_SESSION_ID, { sessionId })
        const url = `${backendBaseUrl}${apiUrl}`
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

    getSentNotifications: ({ page = 1, pageSize = 12 }) => {
        const params = new URLSearchParams()
        params.append("page", page.toString())
        params.append("pageSize", pageSize.toString())
        const apiUrl = buildRoute(ApiRoutes.SENT_NOTIFICATIONS.LIST, {})
        const url = `${backendBaseUrl}${apiUrl}?${params.toString()}`

        return axios
            .get<GetSentNotificationsResponse>(url, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting sent notifications:", error)
                throw error
            })
    },

    getPendingApprovals: (params?: { status?: ApprovalRequestFilter }) => {
        const queryParams = new URLSearchParams()
        if (params?.status) {
            queryParams.append("status", params.status)
        }
        const queryString = queryParams.toString()
        const url = `${backendBaseUrl}${ApiRoutes.PENDING_APPROVALS.LIST}${queryString ? `?${queryString}` : ""}`

        return axios
            .get<GetPendingApprovalsResponse>(url, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting pending approvals:", error)
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
        const url = buildRoute(ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID, { id: destination.id })
        return axios
            .put<NotificationDestination>(`${backendBaseUrl}${url}`, destination, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error updating notification destination:", error)
                throw error
            })
    },

    deleteNotificationDestination: (destination: NotificationDestination) => {
        const url = buildRoute(ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID, { id: destination.id })
        return axios
            .delete<void>(`${backendBaseUrl}${url}`, { withCredentials: true })
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
        const url = buildRoute(ApiRoutes.API_TOKENS.BY_ID, { id })
        return axios
            .patch<ApiToken>(`${backendBaseUrl}${url}`, { name }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error updating API token:", error)
                throw error
            })
    },

    deleteApiToken: (id: string) => {
        const url = buildRoute(ApiRoutes.API_TOKENS.BY_ID, { id })
        return axios
            .delete<void>(`${backendBaseUrl}${url}`, { withCredentials: true })
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

    fetchSampleEvents: (triggers: Array<{ triggerId?: string; integrationId: string; integrationType: IntegrationType; config: AgentTrigger["config"] }>) => {
        return axios
            .post<{ events: SampleEventRef[] }>(`${backendBaseUrl}${ApiRoutes.SDK.SAMPLE_EVENTS}`, { triggers }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching sample events:", error)
                throw error
            })
    },

    hydrateSampleEvent: (entityType: string, entityId: string) => {
        return axios
            .post<{ event: SerializedEvent }>(`${backendBaseUrl}${ApiRoutes.SDK.HYDRATE_SAMPLE_EVENT}`, { entityType, entityId }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error hydrating sample event:", error)
                throw error
            })
    },

    triggerWithEvent: (automationId: string, event?: SerializedEvent, runId?: string) => {
        const url = buildRoute(ApiRoutes.SCHEDULE.TRIGGER_WITH_EVENT, { automationId })
        return axios
            .post<{ received: boolean; message: string }>(`${backendBaseUrl}${url}`, { event: event?.data, runId }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error triggering with event:", error)
                throw error
            })
    },

    triggerManually: (triggerId: string, context?: string) => {
        const url = buildRoute(ApiRoutes.SCHEDULE.TRIGGER_BY_INPUT_ID, { inputId: triggerId })
        return axios
            .post<{ received: boolean; message: string }>(`${backendBaseUrl}${url}`, { context }, { withCredentials: true })
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
        const url = buildRoute(ApiRoutes.ORGANIZATIONS.LOGO, { organizationId })
        return axios
            .get<{ logoUrl: string | null }>(`${backendBaseUrl}${url}`, { withCredentials: true })
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
    },

    getNotificationSettings: () => {
        return axios
            .get<NotificationSettings>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_SETTINGS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error fetching notification settings:", error)
                throw error
            })
    },

    updateNotificationSettings: (agentDefaultNotifications: RunHistoryActionType[], weeklyAgentImprovements: boolean, applyToAllAgents?: boolean) => {
        const payload: UpdateNotificationSettingsRequest = {
            agentDefaultNotifications,
            weeklyAgentImprovements,
            ...(applyToAllAgents !== undefined && { applyToAllAgents })
        }
        return axios
            .post(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_SETTINGS}`, payload, { withCredentials: true })
            .then(() => undefined)
            .catch(error => {
                console.error("Error updating notification settings:", error)
                throw error
            })
    },
    getAgentFiles: (agentId: string) => {
        return axios
            .get<AgentFilesResponse>(`${backendBaseUrl}${buildRoute(ApiRoutes.AGENTS.FILES, { agentId })}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting agent files:", error)
                throw error
            })
    },

    getAgentFileContent: (agentId: string, fileId: string) => {
        return axios
            .get<AgentFileContentResponse>(`${backendBaseUrl}${buildRoute(ApiRoutes.AGENTS.FILE_CONTENT, { agentId, fileId })}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error("Error getting agent file content:", error)
                throw error
            })
    },
    getBalance: () => axios.get<BalanceSummary>(`${backendBaseUrl}${ApiRoutes.BILLING.BALANCE}`, { withCredentials: true }).then(response => response.data),
    getUsage: (params?: { start?: Date; end?: Date }) =>
        axios.get<UsageResponse>(`${backendBaseUrl}${ApiRoutes.BILLING.USAGE}`, { withCredentials: true, params: serializeDates(params) }).then(response => response.data),
    createCheckoutForPlan: (planKey: PlanKey, period: BillingPeriod) =>
        axios
            .post<BillingStripeRedirectResponse>(`${backendBaseUrl}${ApiRoutes.BILLING.CHECKOUT_SESSION}`, { kind: "plan", planKey, period }, { withCredentials: true })
            .then(response => response.data),
    createCheckoutForTopup: (packCredits: number) =>
        axios.post<BillingStripeRedirectResponse>(`${backendBaseUrl}${ApiRoutes.BILLING.CHECKOUT_SESSION}`, { kind: "topup", packCredits }, { withCredentials: true }).then(response => response.data),
    changeBillingSubscription: input => axios.post<BillingChangeResponse>(`${backendBaseUrl}${ApiRoutes.BILLING.CHANGE}`, input, { withCredentials: true }).then(response => response.data),
    createPortalSession: () => axios.post<BillingStripeRedirectResponse>(`${backendBaseUrl}${ApiRoutes.BILLING.PORTAL_SESSION}`, {}, { withCredentials: true }).then(response => response.data),
    setOverageMode: (mode: OverageMode) =>
        axios.patch<SetOverageModeResponse>(`${backendBaseUrl}${ApiRoutes.BILLING.OVERAGE_MODE}`, { mode }, { withCredentials: true }).then(response => response.data)
}

function serializeDates(params?: { start?: Date; end?: Date }) {
    return {
        ...(params?.start ? { start: params.start.toISOString() } : {}),
        ...(params?.end ? { end: params.end.toISOString() } : {})
    }
}

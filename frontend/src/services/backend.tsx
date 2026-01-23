import axios from 'axios';
import type { RunHistoryModelEvent, RunHistoryActionWithId } from "../shared/RunHistoryTypes";
import {
    Agent,
    AgentsResponse,
    AgentUpdate,
    ConfluenceResourcesResponse,
    GetGithubRepositoriesForIntegrationResponse,
    OAuthInstallationDetails,
    JiraCredentialsValidationResponse,
    JiraResourcesResponse,
    LinearTeam,
    NotionResourcesResponse,
    PosthogProjectsResponse,
    LaunchDarklyProjectsResponse,
    LaunchDarklyEnvironmentsResponse,
    DatadogIndexesResponse,
    RecentAgent,
    SlackChannelsResponse,
    StatsResponse,
    SlackUsersResponse,
    AgentTemplate,
} from "../shared/types";
import { GenerateSurveyQuestionsRequest, GenerateSurveyQuestionsResponse, GenerateSurveyPromptRequest, GenerateSurveyPromptResponse } from "../shared/PromptBuilderTypes";
import {
    IntegrationType,
    IntegrationWithStatus,
    GmailIntegration,
    LinearIntegration,
    SlackIntegration,
    AtlassianIntegration,
    FigmaIntegration,
    GithubIntegration,
    NotionIntegration,
    InstallationOptionsFor,
    PosthogIntegration,
    LaunchDarklyIntegration,
    DatadogIntegration,
} from "../shared/Integrations";
import { User } from "../types/User";
import { GetRunHistoryParams, GetRunHistoryResponse } from '../shared/RunHistoryTypes';
import { deserializeConfig } from '../utility/ConfigUtils';
import { CreateNotificationDestinationRequest, NotificationDestination } from '../shared/Notifications';
import { ApiRoutes } from '../shared/ApiRoutes';
import { GetToolsThatRequireApprovalsRequest, GetToolsThatRequireApprovalsResponse } from '../shared/ToolsTypes';

import { SampleEventData } from '../shared/SampleEvents';
import { ConfigInstanceImplementation } from '../shared/Configs';

const backendBaseUrl = '/api';

interface BackendService {
    /**
     * Retrieves the currently authenticated user
     */
    getCurrentUser(): Promise<User>;

    /**
     * Sets the session cookie
     */
    setSession(token: string): Promise<void>;

    /**
     * Retrieves github login URL
     */
    getGithubLogInURL(): Promise<{ url: string }>;

    /**
     * Retrieves google login URL
     */
    getGoogleLogInURL(): Promise<{ url: string }>;

    /**
     * Retrieves users by their IDs
     */
    getUserById(id: string): Promise<User>

    /**
     * Creates a user
     */
    createUser(name: string, email: string, password: string): Promise<User>;

    /**
     * Authenticates a user with email and password
     */
    authenticateUser(email: string, password: string): Promise<User>;

    /**
     * Terminates the current user session
     */
    terminateSession(): Promise<void>;

    /**
     * Gets the activity feed
     */
    getActivityFeed(url?: string): Promise<any>;

    /**
     * Gets the daily activity summary
     */
    getDailyActivitySummary(): Promise<{
        date: string;
        summary: string;
        eventCount: number;
    }>;

    /**
     * Gets statistics for the homepage dashboard
     * @param timezone - Optional IANA timezone string (e.g., "America/New_York")
     */
    getStats(timezone?: string): Promise<StatsResponse>;

    /**
     * Returns the installation details for a given integration type
     */
    getIntegrationInstallationDetails<T extends IntegrationType>(integrationType: T, options?: InstallationOptionsFor<T>): Promise<OAuthInstallationDetails>;

    /**
     * Returns all integrations with their active status for the current user
     */
    getAllIntegrations(): Promise<IntegrationWithStatus[]>;

    /**
     * Returns the active integrations for the current user
     */
    getActiveIntegrations(): Promise<IntegrationType[]>;

    /**
     * Requests a GitHub app installation URL
     */
    requestGitHubAppInstallationUrl(): Promise<{ installationUrl: string }>;

    /**
     * Gets the GitHub repositories for a specific installation
     */
    getGithubRepositoriesForIntegration(installationId: number): Promise<GetGithubRepositoriesForIntegrationResponse>;

    /**
     * Gets the current Slack integration
     */
    getCurrentSlackIntegration(): Promise<SlackIntegration>;

    /**
     * Gets the Jira API key
     */
    getJiraApiKey(): Promise<AtlassianIntegration>;

    /**
     * Sets the Jira API key
     */
    setJiraApiKey(email: string, baseUrl: string, apiKey: string, projectKey?: string): Promise<{ success: boolean; connection?: AtlassianIntegration; error?: string }>;

    /**
     * Validates Jira credentials and fetches available projects
     */
    validateJiraCredentials(baseUrl: string, email: string, apiKey: string): Promise<JiraCredentialsValidationResponse>;

    /**
     * Deletes the Jira API key
     */
    deleteJiraApiKey(): Promise<void>;

    /**
     * Searches Confluence pages by title (search is optional, empty returns all)
     */
    getConfluenceResources(integrationId: string, search?: string): Promise<ConfluenceResourcesResponse>;

    /**
     * Gets Jira resources (projects) for a specific integration
     */
    getJiraResources(integrationId: string): Promise<JiraResourcesResponse>;

    /**
     * Gets Linear teams for a specific integration
     */
    getLinearTeams(integrationId: string): Promise<LinearTeam[]>;

    /**
     * Gets all Gmail integrations for the current user
     */
    getGmailIntegrations(): Promise<GmailIntegration[]>;

    /**
     * Gets all Atlassian integrations for the current user
     */
    getAtlassianIntegrations(): Promise<AtlassianIntegration[]>;

    /**
     * Gets all Figma integrations for the current user
     */
    getFigmaIntegrations(): Promise<FigmaIntegration[]>;

    /**
     * Gets all GitHub integrations for the current user
     */
    getGithubIntegrations(): Promise<GithubIntegration[]>;

    /**
     * Gets all Linear integrations for the current user
     */
    getLinearIntegrations(): Promise<LinearIntegration[]>;

    /**
     * Gets all Notion integrations for the current user
     */
    getNotionIntegrations(): Promise<NotionIntegration[]>;

    /**
     * Gets all Slack integrations for the current user
     */
    getSlackIntegrations(): Promise<SlackIntegration[]>;

    /**
     * Deletes the Gmail integration
     */
    deleteGmailIntegration(): Promise<void>;
    /**
     * Deletes the Notion integration
     */
    deleteNotionIntegration(): Promise<void>;

    /**
     * Searches Notion pages and databases by title
     * @param search - optional search term, empty returns all
     * @param type - optional filter: "page" or "database"
     */
    getNotionResources(integrationId: string, search?: string, type?: 'page' | 'database'): Promise<NotionResourcesResponse>;

    /**
     * Gets all Posthog integrations for the current user
     */
    getPosthogIntegrations(): Promise<PosthogIntegration[]>;

    /**
     * Creates or updates a Posthog integration with API key
     */
    createOrUpdatePosthogIntegration(apiKey: string): Promise<{ success: boolean; email: string | null; orgName: string | null }>;

    /**
     * Gets all LaunchDarkly integrations for the current user
     */
    getLaunchDarklyIntegrations(): Promise<LaunchDarklyIntegration[]>;

    /**
     * Creates or updates a LaunchDarkly integration with API key
     */
    createOrUpdateLaunchDarklyIntegration(apiKey: string): Promise<{ success: boolean; email: string | null }>;

    /**
     * Gets LaunchDarkly projects for an integration
     * @param integrationId - The LaunchDarkly integration ID
     */
    getLaunchDarklyProjects(integrationId: string): Promise<LaunchDarklyProjectsResponse>;

    /**
     * Gets LaunchDarkly environments for a project
     * @param integrationId - The LaunchDarkly integration ID
     * @param projectKey - The LaunchDarkly project key
     */
    getLaunchDarklyEnvironments(integrationId: string, projectKey: string): Promise<LaunchDarklyEnvironmentsResponse>;

    /**
     * Gets all Datadog integrations for the current user
     */
    getDatadogIntegrations(): Promise<DatadogIntegration[]>;

    /**
     * Creates or updates a Datadog integration with API key, APP key, and region
     */
    createOrUpdateDatadogIntegration(apiKey: string, appKey: string, region: string): Promise<{ success: boolean; region: string }>;

    /**
     * Gets Datadog log indexes for an integration
     * @param integrationId - The Datadog integration ID
     */
    getDatadogIndexes(integrationId: string): Promise<DatadogIndexesResponse>;

    /**
     * Gets Posthog projects for an integration
     * @param integrationId - The Posthog integration ID
     * @param search - Optional search term to filter projects
     */
    getPosthogProjects(integrationId: string, search?: string): Promise<PosthogProjectsResponse>;

    /**
     * Gets available channels for a Slack integration
     */
    getSlackChannels(integrationId: string): Promise<SlackChannelsResponse>;

    /**
     * Gets available users for a Slack integration
     */
    getSlackUsers(integrationId: string): Promise<SlackUsersResponse>;

    /**
     * Requests a session socket token
     */
    requestSessionSocketToken(): Promise<string>;

    /**
     * Gets all agents for the user with pagination
     */
    getUserAgents(page?: number, limit?: number, isActive?: boolean, search?: string): Promise<AgentsResponse>;

    /**
     * Gets recently modified agents with last event processed time
     */
    getRecentAgents(limit?: number): Promise<RecentAgent[]>;

    /**
     * Gets a single agent by ID
     */
    getAgentById(id: string): Promise<Agent>;

    /**
     * Creates a new agent
     */
    createAgent(data: AgentUpdate): Promise<{ success: boolean; id: string }>;

    /**
     * Updates an existing agent
     */
    updateAgent(id: string, data: AgentUpdate): Promise<{ success: boolean; id: string }>;

    /**
     * Deletes an agent
     */
    deleteAgent(id: string): Promise<{ success: boolean; message: string }>;

    /**
     * Fetch run history for a specific agent with filters and pagination
     */
    getRunHistory(agentId: string, params: GetRunHistoryParams): Promise<GetRunHistoryResponse>;

    /**
     * Fetch chat history for a specific run
     */
    getChatHistory(runId: string): Promise<{ events: Array<RunHistoryModelEvent>; startTimestamp?: string; endTimestamp?: string; status?: string }>;

    /**
     * Fetch run history actions by IDs
     */
    getRunHistoryActions(ids: string[]): Promise<RunHistoryActionWithId[]>;

    /**
     * Generates clarifying questions for prompt builder
     */
    generatePromptBuilderQuestions(request: GenerateSurveyQuestionsRequest): Promise<GenerateSurveyQuestionsResponse>;

    /**
     * Generates a prompt based on description and answers
     */
    generatePromptBuilderPrompt(request: GenerateSurveyPromptRequest): Promise<GenerateSurveyPromptResponse>;

    /**
     * Gets all notification destinations for the current user
     */
    getNotificationDestinations(): Promise<NotificationDestination[]>;

    /**
     * Creates a new notification destination
     */
    createNotificationDestination(destination: CreateNotificationDestinationRequest): Promise<NotificationDestination>;

    /**
     * Updates an existing notification destination
     */
    updateNotificationDestination(destination: NotificationDestination): Promise<NotificationDestination>;

    /**
     * Deletes a notification destination
     */
    deleteNotificationDestination(destination: NotificationDestination): Promise<void>;

    /**
     * Gets all available agent templates
     */
    getTemplates(): Promise<AgentTemplate[]>;

    /**
     * Manually triggers a scheduled automation trigger
     * @param triggerId - The ID of the time trigger to trigger
     * @param context - Optional context explaining why the trigger is being run manually
     */
    triggerManually(triggerId: string, context?: string): Promise<{ received: boolean; message: string }>;

    /**
     * Gets write-only tools that require approval for the given skills and knowledge bases
     */
    getToolsThatRequireApprovals(request: GetToolsThatRequireApprovalsRequest): Promise<GetToolsThatRequireApprovalsResponse>;

    getSampleEvents(config: ConfigInstanceImplementation): Promise<SampleEventData[]>;
}

export const BackendProvider: BackendService = {
    getCurrentUser: () => {
        return axios.get<User>(`${backendBaseUrl}${ApiRoutes.AUTH.ME}`, { withCredentials: true })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            });
    },

    getGithubLogInURL: () => {
        return axios.get<{ url: string }>(`${backendBaseUrl}${ApiRoutes.AUTH.GITHUB_LOGIN_URL}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting GitHub login URL:', error);
                throw error;
            });
    },

    getGoogleLogInURL: () => {
        return axios.get<{ url: string }>(`${backendBaseUrl}${ApiRoutes.AUTH.GOOGLE_LOGIN_URL}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Google login URL:', error);
                throw error;
            });
    },

    setSession: (token: string) => {
        return axios.post(`${backendBaseUrl}${ApiRoutes.AUTH.SET_SESSION}`, { token }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error setting session:', error);
                throw error;
            });
    },

    getUserById: (id: string) => {
        return axios.get<User>(`${backendBaseUrl}${ApiRoutes.USERS.BY_ID.build(id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching user:', error);
                throw error;
            });
    },

    createUser: (name: string, email: string, password: string) => {
        return axios.post(`${backendBaseUrl}${ApiRoutes.USERS.CREATE}`, { name, email, password }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating user:', error);
                throw error;
            });
    },

    authenticateUser: (email: string, password: string) => {
        return axios.post(`${backendBaseUrl}${ApiRoutes.AUTH.LOGIN}`, { email, password }, { withCredentials: true })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error('Error logging in:', error);
                throw error;
            });
    },

    terminateSession: () => {
        return axios.post(`${backendBaseUrl}${ApiRoutes.AUTH.LOGOUT}`, {}, { withCredentials: true })
            .then(_ => {
            })
            .catch(error => {
                console.error('Error logging out:', error);
                throw error;
            });
    },

    getActivityFeed: (url?: string) => {
        const endpoint = url ? `${backendBaseUrl}${url}` : `${backendBaseUrl}${ApiRoutes.ACTIVITY.FEED}`;
        return axios.get(endpoint, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting activity feed:', error);
                throw error;
            });
    },

    getDailyActivitySummary: () => {
        return axios.get(`${backendBaseUrl}${ApiRoutes.ACTIVITY.DAILY_SUMMARY}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting daily activity summary:', error);
                throw error;
            });
    },

    getStats: (timezone?: string) => {
        const params = timezone ? { tz: timezone } : {};
        return axios.get(`${backendBaseUrl}${ApiRoutes.STATS}`, { withCredentials: true, params })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting stats:', error);
                throw error;
            });
    },

    getIntegrationInstallationDetails: <T extends IntegrationType>(integrationType: T, options?: InstallationOptionsFor<T>) => {
        const params = new URLSearchParams();
        if (options) {
            params.append('options', JSON.stringify(options));
        }
        const queryString = params.toString();
        const url = `${backendBaseUrl}${ApiRoutes.INTEGRATIONS.INSTALLATION_DETAILS_BY_TYPE.build(integrationType)}${queryString ? `?${queryString}` : ''}`;
        return axios.get(url, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting integration installation details:', error);
                throw error;
            });
    },

    getAllIntegrations: () => {
        return axios.get(`${backendBaseUrl}${ApiRoutes.INTEGRATIONS.LIST}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting all integrations:', error);
                throw error;
            });
    },

    getActiveIntegrations: () => {
        return axios.get(`${backendBaseUrl}${ApiRoutes.INTEGRATIONS.ACTIVE}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting active integrations:', error);
                throw error;
            });
    },

    getGithubRepositoriesForIntegration: (installationId: number) => {
        return axios.get(`${backendBaseUrl}${ApiRoutes.GITHUB.GET_REPOSITORIES_FOR_INTEGRATION}`, {
            params: { installation_id: installationId },
            withCredentials: true
        })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting GitHub repositories for integration:', error);
                throw error;
            });
    },

    requestGitHubAppInstallationUrl: () => {
        return axios.get(`${backendBaseUrl}${ApiRoutes.GITHUB.INSTALLATION_URL}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error requesting GitHub app installation URL:', error);
                throw error;
            });
    },

    getCurrentSlackIntegration: () => {
        return axios.get(`${backendBaseUrl}${ApiRoutes.SLACK.GET_CURRENT_INTEGRATION}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting current Slack integration:', error);
                throw error;
            });
    },

    getJiraApiKey: () => {
        return axios.get(`${backendBaseUrl}${ApiRoutes.JIRA.GET_API_KEY}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Jira API key:', error);
                throw error;
            });
    },

    setJiraApiKey: (email: string, baseUrl: string, apiKey: string, projectKey?: string) => {
        return axios.post(`${backendBaseUrl}${ApiRoutes.JIRA.SET_API_KEY}`, { email, baseUrl, apiKey, projectKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error setting Jira API key:', error);
                const errorMessage = error.response?.data?.error || 'Failed to create Jira connection';
                throw { success: false, error: errorMessage };
            });
    },

    validateJiraCredentials: (baseUrl: string, email: string, apiKey: string) => {
        return axios.post(`${backendBaseUrl}${ApiRoutes.JIRA.VALIDATE_AND_FETCH_PROJECTS}`, { baseUrl, email, apiKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error validating Jira credentials:', error);
                const errorMessage = error.response?.data?.error || 'Failed to validate credentials';
                return { valid: false, error: errorMessage };
            });
    },

    deleteJiraApiKey: () => {
        return axios.delete(`${backendBaseUrl}${ApiRoutes.JIRA.DELETE_CREDENTIALS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting Jira API key:', error);
                throw error;
            });
    },

    getConfluenceResources: (integrationId: string, search?: string) => {
        const params = new URLSearchParams({ integrationId });
        if (search) {
            params.append('search', search);
        }
        return axios.get<ConfluenceResourcesResponse>(`${backendBaseUrl}${ApiRoutes.CONFLUENCE.RESOURCES}?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error searching Confluence resources:', error);
                throw error;
            });
    },

    getJiraResources: (integrationId: string) => {
        return axios.get<JiraResourcesResponse>(`${backendBaseUrl}${ApiRoutes.JIRA.RESOURCES}?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Jira resources:', error);
                throw error;
            });
    },

    getLinearTeams: (integrationId: string) => {
        return axios.get<LinearTeam[]>(`${backendBaseUrl}${ApiRoutes.LINEAR.TEAMS}?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Linear teams:', error);
                throw error;
            });
    },

    getGmailIntegrations: () => {
        return axios.get<GmailIntegration[]>(`${backendBaseUrl}${ApiRoutes.GMAIL.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Gmail integrations:', error);
                throw error;
            });
    },

    getAtlassianIntegrations: () => {
        return axios.get<AtlassianIntegration[]>(`${backendBaseUrl}${ApiRoutes.ATLASSIAN.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Atlassian integrations:', error);
                throw error;
            });
    },

    getFigmaIntegrations: () => {
        return axios.get<FigmaIntegration[]>(`${backendBaseUrl}${ApiRoutes.FIGMA.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Figma integrations:', error);
                throw error;
            });
    },

    getGithubIntegrations: () => {
        return axios.get<GithubIntegration[]>(`${backendBaseUrl}${ApiRoutes.GITHUB.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting GitHub integrations:', error);
                throw error;
            });
    },

    getLinearIntegrations: () => {
        return axios.get<LinearIntegration[]>(`${backendBaseUrl}${ApiRoutes.LINEAR.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Linear integrations:', error);
                throw error;
            });
    },

    getNotionIntegrations: () => {
        return axios.get<NotionIntegration[]>(`${backendBaseUrl}${ApiRoutes.NOTION.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Notion integrations:', error);
                throw error;
            });
    },

    getPosthogIntegrations: () => {
        return axios.get<PosthogIntegration[]>(`${backendBaseUrl}${ApiRoutes.POSTHOG.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Posthog integrations:', error);
                throw error;
            });
    },

    createOrUpdatePosthogIntegration: (apiKey: string) => {
        return axios.post<{ success: boolean; email: string | null; orgName: string | null }>(
            `${backendBaseUrl}${ApiRoutes.POSTHOG.INTEGRATIONS}`,
            { apiKey },
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating/updating Posthog integration:', error);
                throw error;
            });
    },

    getLaunchDarklyIntegrations: () => {
        return axios.get<LaunchDarklyIntegration[]>(`${backendBaseUrl}${ApiRoutes.LAUNCHDARKLY.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting LaunchDarkly integrations:', error);
                throw error;
            });
    },

    getDatadogIntegrations: () => {
        return axios.get<DatadogIntegration[]>(`${backendBaseUrl}${ApiRoutes.DATADOG.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Datadog integrations:', error);
                throw error;
            });
    },

    createOrUpdateLaunchDarklyIntegration: (apiKey: string) => {
        return axios.post<{ success: boolean; email: string | null }>(
            `${backendBaseUrl}${ApiRoutes.LAUNCHDARKLY.INTEGRATIONS}`,
            { apiKey },
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating/updating LaunchDarkly integration:', error);
                throw error;
            });
    },

    createOrUpdateDatadogIntegration: (apiKey: string, appKey: string, region: string) => {
        return axios.post<{ success: boolean; region: string }>(
            `${backendBaseUrl}${ApiRoutes.DATADOG.INTEGRATIONS}`,
            { apiKey, appKey, region },
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating/updating Datadog integration:', error);
                throw error;
            });
    },

    getLaunchDarklyProjects: (integrationId: string) => {
        return axios.get<LaunchDarklyProjectsResponse>(
            `${backendBaseUrl}${ApiRoutes.LAUNCHDARKLY.PROJECTS_BY_INTEGRATION_ID.build(integrationId)}`,
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching LaunchDarkly projects:', error);
                throw error;
            });
    },

    getLaunchDarklyEnvironments: (integrationId: string, projectKey: string) => {
        return axios.get<LaunchDarklyEnvironmentsResponse>(
            `${backendBaseUrl}${ApiRoutes.LAUNCHDARKLY.ENVIRONMENTS_BY_INTEGRATION_AND_PROJECT.build(integrationId, projectKey)}`,
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching LaunchDarkly environments:', error);
                throw error;
            });
    },

    getDatadogIndexes: (integrationId: string) => {
        return axios.get<DatadogIndexesResponse>(
            `${backendBaseUrl}/datadog/indexes`,
            { 
                params: { integrationId },
                withCredentials: true 
            }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Datadog indexes:', error);
                throw error;
            });
    },

    getPosthogProjects: (integrationId: string, search?: string) => {
        const params = new URLSearchParams({ integrationId });
        if (search) {
            params.append('search', search);
        }
        return axios.get<PosthogProjectsResponse>(`${backendBaseUrl}${ApiRoutes.POSTHOG.PROJECTS}?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Posthog projects:', error);
                throw error;
            });
    },

    getSlackIntegrations: () => {
        return axios.get<SlackIntegration[]>(`${backendBaseUrl}${ApiRoutes.SLACK.INTEGRATIONS}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Slack integrations:', error);
                throw error;
            });
    },

    deleteGmailIntegration: () => {
        return axios.delete(`${backendBaseUrl}/gmail/delete-integration`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting Gmail integration:', error);
                throw error;
            });
    },

    deleteNotionIntegration: () => {
        return axios.delete(`${backendBaseUrl}${ApiRoutes.NOTION.DELETE_INTEGRATION}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting Notion integration:', error);
                throw error;
            });
    },

    getNotionResources: (integrationId: string, search?: string, type?: 'page' | 'database') => {
        const params = new URLSearchParams({ integrationId });
        if (search) {
            params.append('search', search);
        }
        if (type) {
            params.append('type', type);
        }
        return axios.get<NotionResourcesResponse>(`${backendBaseUrl}${ApiRoutes.NOTION.RESOURCES}?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error searching Notion resources:', error);
                throw error;
            });
    },

    getSlackChannels: (integrationId: string) => {
        return axios.get<SlackChannelsResponse>(`${backendBaseUrl}${ApiRoutes.SLACK.CHANNELS}?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Slack channels:', error);
                throw error;
            });
    },

    getSlackUsers: (integrationId: string) => {
        return axios.get<SlackUsersResponse>(`${backendBaseUrl}${ApiRoutes.SLACK.USERS}?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Slack users:', error);
                throw error;
            });
    },

    requestSessionSocketToken: () => {
        return axios.get(`${backendBaseUrl}${ApiRoutes.SESSION.TOKEN}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error requesting session socket token:', error);
                throw error;
            });
    },

    getUserAgents: (page = 1, limit = 10, isActive?: boolean, search?: string) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (isActive !== undefined) {
            params.append('isActive', isActive.toString());
        }
        if (search) {
            params.append('search', search);
        }

        return axios.get<AgentsResponse>(`${backendBaseUrl}${ApiRoutes.AGENTS.LIST}?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting agents:', error);
                throw error;
            });
    },

    getRecentAgents: (limit = 3) => {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());

        return axios.get<RecentAgent[]>(`${backendBaseUrl}${ApiRoutes.AGENTS.RECENT}?${params.toString()}`, { withCredentials: true })
            .then(response => {
                // Deserialize configs from JSON to class instances
                return response.data.map(agent => ({
                    ...agent,
                    triggers: agent.triggers.map(trigger => ({
                        ...trigger,
                        config: deserializeConfig(trigger.config)
                    })),
                    outputs: agent.outputs ? agent.outputs.map(output => ({
                        ...output,
                        config: deserializeConfig(output.config)
                    })) : []
                }));
            })
            .catch(error => {
                console.error('Error getting recent agents:', error);
                throw error;
            });
    },

    getAgentById: (id: string) => {
        return axios.get<Agent>(`${backendBaseUrl}${ApiRoutes.AGENTS.BY_ID.build(id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting agent:', error);
                throw error;
            });
    },

    createAgent: (data: Agent) => {
        return axios.post<{ success: boolean; id: string }>(`${backendBaseUrl}${ApiRoutes.AGENTS.LIST}`,
            data,
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating agent:', error);
                throw error;
            });
    },

    updateAgent: (id: string, data: AgentUpdate) => {
        return axios.patch<{ success: boolean; id: string }>(`${backendBaseUrl}${ApiRoutes.AGENTS.BY_ID.build(id)}`,
            data,
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error updating agent:', error);
                throw error;
            });
    },

    deleteAgent: (id: string) => {
        return axios.delete<{ success: boolean; message: string }>(`${backendBaseUrl}${ApiRoutes.AGENTS.BY_ID.build(id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting agent:', error);
                throw error;
            });
    },

    getRunHistory: (agentId, params) => {
        const usp = new URLSearchParams();
        if (params.page) usp.append('page', String(params.page));
        if (params.pageSize) usp.append('pageSize', String(params.pageSize));
        if (params.q) usp.append('q', params.q);
        if (params.start) usp.append('start', params.start);
        if (params.end) usp.append('end', params.end);
        if (params.status && params.status.length) usp.append('status', params.status.join(','));
        const url = `${backendBaseUrl}${ApiRoutes.RUN_HISTORY.BY_AGENT_ID.build(agentId)}${usp.toString() ? `?${usp.toString()}` : ''}`;
        return axios.get<GetRunHistoryResponse>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error('Error fetching run history:', error);
                throw error;
            });
    },

    getChatHistory: (runId) => {
        const url = `${backendBaseUrl}${ApiRoutes.RUN_HISTORY.CHAT_BY_RUN_ID.build(runId)}`;
        return axios.get<{ events: Array<RunHistoryModelEvent>; startTimestamp?: string; endTimestamp?: string; status?: string }>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error('Error fetching chat history:', error);
                throw error;
            });
    },

    getRunHistoryActions: (ids) => {
        const usp = new URLSearchParams();
        usp.append('ids', ids.join(','));
        const url = `${backendBaseUrl}${ApiRoutes.RUN_HISTORY.ACTIONS}?${usp.toString()}`;
        return axios.get<RunHistoryActionWithId[]>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error('Error fetching run history actions:', error);
                throw error;
            });
    },

    generatePromptBuilderQuestions: (request: GenerateSurveyQuestionsRequest) => {
        return axios.post<GenerateSurveyQuestionsResponse>(
            `${backendBaseUrl}${ApiRoutes.PROMPT_BUILDER.GENERATE_QUESTIONS}`,
            request,
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error generating questions:', error);
                throw error;
            });
    },

    getNotificationDestinations: () => {
        return axios.get<NotificationDestination[]>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_DESTINATIONS.LIST}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting notification destinations:', error);
                throw error;
            });
    },

    generatePromptBuilderPrompt: (request: GenerateSurveyPromptRequest) => {
        return axios.post<GenerateSurveyPromptResponse>(
            `${backendBaseUrl}${ApiRoutes.PROMPT_BUILDER.GENERATE_PROMPT}`,
            request,
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error generating prompt:', error);
                throw error;
            });
    },

    createNotificationDestination: (destination: CreateNotificationDestinationRequest) => {
        return axios.post<NotificationDestination>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_DESTINATIONS.LIST}`, destination, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating notification destination:', error);
                throw error;
            });
    },

    updateNotificationDestination: (destination: NotificationDestination) => {
        return axios.put<NotificationDestination>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID.build(destination.id)}`, destination, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error updating notification destination:', error);
                throw error;
            });
    },

    deleteNotificationDestination: (destination: NotificationDestination) => {
        return axios.delete<void>(`${backendBaseUrl}${ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID.build(destination.id)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting notification destination:', error);
                throw error;
            });
    },

    getTemplates: () => {
        return axios.get<AgentTemplate[]>(`${backendBaseUrl}${ApiRoutes.TEMPLATES}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting templates:', error);
                throw error;
            });
    },

    triggerManually: (triggerId: string, context?: string) => {
        return axios.post<{ received: boolean; message: string }>(
            `${backendBaseUrl}${ApiRoutes.SCHEDULE.TRIGGER_BY_INPUT_ID.build(triggerId)}`,
            { context },
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error triggering manually:', error);
                throw error;
            });
    },

    getToolsThatRequireApprovals: (request: GetToolsThatRequireApprovalsRequest) => {
        return axios.post<GetToolsThatRequireApprovalsResponse>(`${backendBaseUrl}${ApiRoutes.TOOLS.THAT_REQUIRE_APPROVALS}`, request, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting tools that require approvals:', error);
                throw error;
            });
    },

    getSampleEvents: (config: ConfigInstanceImplementation) => {
        return axios.post<SampleEventData[]>(`${backendBaseUrl}${ApiRoutes.SAMPLE_EVENTS}`, config, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting sample events:', error);
                throw error;
            });
    },
}

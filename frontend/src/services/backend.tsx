import axios from 'axios';
import type { RunHistoryModelEvent } from "../shared/RunHistoryTypes";
import {
    Channel,
    ChannelInput, 
    ChannelOutput,
    ChannelPrompt, 
    ChannelsResponse, 
    ChannelUpdate, 
    ConfluenceResourcesResponse, 
    GetGithubRepositoriesForIntegrationResponse, 
    OAuthInstallationDetails, 
    JiraCredentialsValidationResponse, 
    JiraResourcesResponse,
    NotionResourcesResponse, 
    RecentChannel,
    SlackChannelsResponse,
    StatsResponse, 
} from "../shared/types";
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
} from "../shared/Integrations";
import { User } from "../types/User";
import { GetRunHistoryParams, GetRunHistoryResponse } from '../shared/RunHistoryTypes';
import { deserializeConfig } from '../utility/ConfigUtils';

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
     */
    getStats(): Promise<StatsResponse>;

    /**
     * Returns the installation details for a given integration type
     */
    getIntegrationInstallationDetails(integrationType: IntegrationType): Promise<OAuthInstallationDetails>;

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
     * Gets the Confluence resources
     */
    getConfluenceResources(integrationId: string): Promise<ConfluenceResourcesResponse>;

    /**
     * Gets Jira resources (projects) for a specific integration
     */
    getJiraResources(integrationId: string): Promise<JiraResourcesResponse>;

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
     * Gets available databases for a Notion integration
     */
    getNotionResources(integrationId: string): Promise<NotionResourcesResponse>;

    /**
     * Gets available channels for a Slack integration
     */
    getSlackChannels(integrationId: string): Promise<SlackChannelsResponse>;

    /**
     * Requests a session socket token
     */
    requestSessionSocketToken(): Promise<string>;

    /**
     * Gets all channels for the user with pagination
     */
    getUserChannels(page?: number, limit?: number, isActive?: boolean, search?: string): Promise<ChannelsResponse>;

    /**
     * Gets recently modified channels with last event processed time
     */
    getRecentChannels(limit?: number): Promise<RecentChannel[]>;

    /**
     * Gets a single channel by ID
     */
    getChannelById(id: string): Promise<Channel>;

    /**
     * Creates a new channel
     */
    createChannel(name: string, inputs: ChannelInput[], output: ChannelOutput, prompt: ChannelPrompt, isActive?: boolean): Promise<{ success: boolean; id: string }>;

    /**
     * Updates an existing channel
     */
    updateChannel(id: string, data: ChannelUpdate): Promise<{ success: boolean; id: string }>;

    /**
     * Deletes a channel
     */
    deleteChannel(id: string): Promise<{ success: boolean; message: string }>;

    /**
     * Fetch run history for a specific channel with filters and pagination
     */
    getRunHistory(channelId: string, params: GetRunHistoryParams): Promise<GetRunHistoryResponse>;

    /**
     * Fetch chat history for a specific run
     */
    getChatHistory(runId: string): Promise<{ events: Array<RunHistoryModelEvent>; startTimestamp?: string; endTimestamp?: string; status?: string }>;
}

export const BackendProvider: BackendService = {
    getCurrentUser: () => {
        return axios.get<User>(`${backendBaseUrl}/me`, { withCredentials: true })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                throw error;
            });
    },

    getGithubLogInURL: () => {
        return axios.get<{ url: string }>(`${backendBaseUrl}/auth/github/login-url`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting GitHub login URL:', error);
                throw error;
            });
    },

    getGoogleLogInURL: () => {
        return axios.get<{ url: string }>(`${backendBaseUrl}/auth/google/login-url`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Google login URL:', error);
                throw error;
            });
    },

    setSession: (token: string) => {
        return axios.post(`${backendBaseUrl}/auth/set-session`, { token }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error setting session:', error);
                throw error;
            });
    },

    getUserById: (id: string) => {
        return axios.get<User>(`${backendBaseUrl}/users/${id}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching user:', error);
                throw error;
            });
    },

    createUser: (name: string, email: string, password: string) => {
        return axios.post(`${backendBaseUrl}/users`, { name, email, password }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating user:', error);
                throw error;
            });
    },

    authenticateUser: (email: string, password: string) => {
        return axios.post(`${backendBaseUrl}/login`, { email, password }, { withCredentials: true })
            .then(response => {
                return response.data;
            })
            .catch(error => {
                console.error('Error logging in:', error);
                throw error;
            });
    },

    terminateSession: () => {
        return axios.post(`${backendBaseUrl}/logout`, {}, { withCredentials: true })
            .then(_ => {
            })
            .catch(error => {
                console.error('Error logging out:', error);
                throw error;
            });
    },

    getActivityFeed: (url?: string) => {
        const endpoint = url ? `${backendBaseUrl}${url}` : `${backendBaseUrl}/activity-feed`;
        return axios.get(endpoint, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting activity feed:', error);
                throw error;
            });
    },

    getDailyActivitySummary: () => {
        return axios.get(`${backendBaseUrl}/activity/daily-summary`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting daily activity summary:', error);
                throw error;
            });
    },

    getStats: () => {
        return axios.get(`${backendBaseUrl}/stats`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting stats:', error);
                throw error;
            });
    },

    getIntegrationInstallationDetails: (integrationType: IntegrationType) => {
        return axios.get(`${backendBaseUrl}/integrations/${integrationType}/installation-details`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting integration installation details:', error);
                throw error;
            });
    },

    getAllIntegrations: () => {
        return axios.get(`${backendBaseUrl}/integrations`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting all integrations:', error);
                throw error;
            });
    },

    getActiveIntegrations: () => {
        return axios.get(`${backendBaseUrl}/integrations/active`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting active integrations:', error);
                throw error;
            });
    },

    getGithubRepositoriesForIntegration: (installationId: number) => {
        return axios.get(`${backendBaseUrl}/github/get-repositories-for-integration`, {
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
        return axios.get(`${backendBaseUrl}/github/installation-url`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error requesting GitHub app installation URL:', error);
                throw error;
            });
    },

    getCurrentSlackIntegration: () => {
        return axios.get(`${backendBaseUrl}/slack/get-current-integration`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting current Slack integration:', error);
                throw error;
            });
    },

    getJiraApiKey: () => {
        return axios.get(`${backendBaseUrl}/jira/get-api-key`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Jira API key:', error);
                throw error;
            });
    },

    setJiraApiKey: (email: string, baseUrl: string, apiKey: string, projectKey?: string) => {
        return axios.post(`${backendBaseUrl}/jira/set-api-key`, { email, baseUrl, apiKey, projectKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error setting Jira API key:', error);
                const errorMessage = error.response?.data?.error || 'Failed to create Jira connection';
                throw { success: false, error: errorMessage };
            });
    },

    validateJiraCredentials: (baseUrl: string, email: string, apiKey: string) => {
        return axios.post(`${backendBaseUrl}/jira/validate-and-fetch-projects`, { baseUrl, email, apiKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error validating Jira credentials:', error);
                const errorMessage = error.response?.data?.error || 'Failed to validate credentials';
                return { valid: false, error: errorMessage };
            });
    },

    deleteJiraApiKey: () => {
        return axios.delete(`${backendBaseUrl}/jira/delete-credentials`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting Jira API key:', error);
                throw error;
            });
    },

    getConfluenceResources: (integrationId: string) => {
        return axios.get<ConfluenceResourcesResponse>(`${backendBaseUrl}/confluence/resources?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Confluence resources:', error);
                throw error;
            });
    },

    getJiraResources: (integrationId: string) => {
        return axios.get<JiraResourcesResponse>(`${backendBaseUrl}/jira/resources?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Jira resources:', error);
                throw error;
            });
    },

    getGmailIntegrations: () => {
        return axios.get<GmailIntegration[]>(`${backendBaseUrl}/gmail/integrations`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Gmail integrations:', error);
                throw error;
            });
    },

    getAtlassianIntegrations: () => {
        return axios.get<AtlassianIntegration[]>(`${backendBaseUrl}/atlassian/integrations`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Atlassian integrations:', error);
                throw error;
            });
    },

    getFigmaIntegrations: () => {
        return axios.get<FigmaIntegration[]>(`${backendBaseUrl}/figma/integrations`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Figma integrations:', error);
                throw error;
            });
    },

    getGithubIntegrations: () => {
        return axios.get<GithubIntegration[]>(`${backendBaseUrl}/github/integrations`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting GitHub integrations:', error);
                throw error;
            });
    },

    getLinearIntegrations: () => {
        return axios.get<LinearIntegration[]>(`${backendBaseUrl}/linear/integrations`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Linear integrations:', error);
                throw error;
            });
    },

    getNotionIntegrations: () => {
        return axios.get<NotionIntegration[]>(`${backendBaseUrl}/notion/integrations`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Notion integrations:', error);
                throw error;
            });
    },

    getSlackIntegrations: () => {
        return axios.get<SlackIntegration[]>(`${backendBaseUrl}/slack/integrations`, { withCredentials: true })
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
        return axios.delete(`${backendBaseUrl}/notion/delete-integration`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting Notion integration:', error);
                throw error;
            });
    },

    getNotionResources: (integrationId: string) => {
        return axios.get<NotionResourcesResponse>(`${backendBaseUrl}/notion/resources?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Notion databases:', error);
                throw error;
            });
    },

    getSlackChannels: (integrationId: string) => {
        return axios.get<SlackChannelsResponse>(`${backendBaseUrl}/slack/channels?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error fetching Slack channels:', error);
                throw error;
            });
    },

    requestSessionSocketToken: () => {
        return axios.get(`${backendBaseUrl}/session/token`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error requesting session socket token:', error);
                throw error;
            });
    },

    getUserChannels: (page = 1, limit = 10, isActive?: boolean, search?: string) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (isActive !== undefined) {
            params.append('isActive', isActive.toString());
        }
        if (search) {
            params.append('search', search);
        }

        return axios.get<ChannelsResponse>(`${backendBaseUrl}/channels?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting channels:', error);
                throw error;
            });
    },

    getRecentChannels: (limit = 3) => {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());

        return axios.get<RecentChannel[]>(`${backendBaseUrl}/channels/recent?${params.toString()}`, { withCredentials: true })
            .then(response => {
                // Deserialize configs from JSON to class instances
                return response.data.map(channel => ({
                    ...channel,
                    inputs: channel.inputs.map(input => ({
                        ...input,
                        config: deserializeConfig(input.config)
                    })),
                    output: {
                        ...channel.output,
                        config: deserializeConfig(channel.output.config)
                    }
                }));
            })
            .catch(error => {
                console.error('Error getting recent channels:', error);
                throw error;
            });
    },

    getChannelById: (id: string) => {
        return axios.get<Channel>(`${backendBaseUrl}/channels/${id}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting channel:', error);
                throw error;
            });
    },

    createChannel: (name: string, inputs: ChannelInput[], output: ChannelOutput, prompt: ChannelPrompt, isActive = true) => {
        return axios.post<{ success: boolean; id: string }>(`${backendBaseUrl}/channels`,
            { name, inputs, output, prompt, isActive },
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating channel:', error);
                throw error;
            });
    },

    updateChannel: (id: string, data: ChannelUpdate) => {
        return axios.patch<{ success: boolean; id: string }>(`${backendBaseUrl}/channels/${id}`,
            data,
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error updating channel:', error);
                throw error;
            });
    },

    deleteChannel: (id: string) => {
        return axios.delete<{ success: boolean; message: string }>(`${backendBaseUrl}/channels/${id}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting channel:', error);
                throw error;
            });
    },

    getRunHistory: (channelId, params) => {
        const usp = new URLSearchParams();
        if (params.page) usp.append('page', String(params.page));
        if (params.pageSize) usp.append('pageSize', String(params.pageSize));
        if (params.q) usp.append('q', params.q);
        if (params.start) usp.append('start', params.start);
        if (params.end) usp.append('end', params.end);
        if (params.status && params.status.length) usp.append('status', params.status.join(','));
        const url = `${backendBaseUrl}/run-history/${encodeURIComponent(channelId)}${usp.toString() ? `?${usp.toString()}` : ''}`;
        return axios.get<GetRunHistoryResponse>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error('Error fetching run history:', error);
                throw error;
            });
    },

    getChatHistory: (runId) => {
        const url = `${backendBaseUrl}/run-history/${encodeURIComponent(runId)}/chat`;
        return axios.get<{ events: Array<RunHistoryModelEvent>; startTimestamp?: string; endTimestamp?: string; status?: string }>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error('Error fetching chat history:', error);
                throw error;
            });
    },
}

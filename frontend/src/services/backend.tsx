import axios from 'axios';
import { ModelEvent, ModelRequest } from "../shared/ModelEvents";
import {
    Automation,
    AutomationInput, 
    AutomationOutput,
    AutomationPrompt, 
    AutomationsResponse, 
    AutomationUpdate, 
    ConfluenceResourcesResponse, 
    GetGithubRepositoriesForIntegrationResponse, 
    OAuthInstallationDetails, 
    JiraCredentialsValidationResponse, 
    LinearApiKeyValidationResponse, 
    NotionResourcesResponse, 
    SlackChannelsResponse, 
} from "../shared/types";
import { 
    IntegrationType,
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
     * Returns the installation details for a given integration type
     */
    getIntegrationInstallationDetails(integrationType: IntegrationType): Promise<OAuthInstallationDetails>;

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
     * Gets the Linear API key
     */
    getLinearApiKey(): Promise<LinearIntegration>;

    /**
     * Sets the Linear API key
     */
    setLinearApiKey(apiKey: string, teamId?: string): Promise<{ success: boolean; connection?: any; error?: string }>;

    /**
     * Validates Linear API key and fetches available teams
     */
    validateLinearApiKey(apiKey: string): Promise<LinearApiKeyValidationResponse>;

    /**
     * Deletes the Linear API key
     */
    deleteLinearApiKey(): Promise<void>;

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
     * Sets the Confluence API key
     */
    setConfluenceApiKey(email: string, baseUrl: string, apiKey: string, projectKey?: string): Promise<{ success: boolean; connection?: AtlassianIntegration; error?: string }>;

    /**
     * Validates Confluence credentials
     */
    validateConfluenceCredentials(baseUrl: string, email: string, apiKey: string): Promise<{ valid: boolean; error?: string }>;

    /**
     * Gets the Confluence resources
     */
    getConfluenceResources(integrationId: string): Promise<ConfluenceResourcesResponse>;

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
     * Creates a completion socket
     */
    connectToCompletionSocket({
        onMessageReceived,
        onOpen,
        onClose,
        onError
    }: {
        onMessageReceived: (modelEvent: ModelEvent) => void,
        onOpen: () => void,
        onClose: () => void,
        onError: (error: Event) => void
    }): Promise<Connection>;

    /**
     * Gets the user's automation (returns null if none exists)
     * @deprecated Use getUserAutomations instead
     */
    getUserAutomation(): Promise<Automation | null>;

    /**
     * Gets all automations for the user with pagination
     */
    getUserAutomations(page?: number, limit?: number, isActive?: boolean, search?: string): Promise<AutomationsResponse>;

    /**
     * Gets a single automation by ID
     */
    getAutomationById(id: string): Promise<Automation>;

    /**
     * Creates a new automation
     */
    createAutomation(name: string, inputs: AutomationInput[], output: AutomationOutput, prompt: AutomationPrompt, isActive?: boolean): Promise<{ success: boolean; id: string }>;

    /**
     * Updates an existing automation
     */
    updateAutomation(id: string, data: AutomationUpdate): Promise<{ success: boolean; id: string }>;

    /**
     * Deletes an automation
     */
    deleteAutomation(id: string): Promise<{ success: boolean; message: string }>;

    /**
     * Fetch run history for a specific automation with filters and pagination
     */
    getRunHistory(automationId: string, params: GetRunHistoryParams): Promise<GetRunHistoryResponse>;
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

    getIntegrationInstallationDetails: (integrationType: IntegrationType) => {
        return axios.get(`${backendBaseUrl}/integrations/${integrationType}/installation-details`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting integration installation details:', error);
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

    getLinearApiKey: () => {
        return axios.get(`${backendBaseUrl}/linear/get-api-key`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Linear API key:', error);
                throw error;
            });
    },

    setLinearApiKey: (apiKey: string, teamId?: string) => {
        return axios.post(`${backendBaseUrl}/linear/set-api-key`, { apiKey, teamId }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error setting Linear API key:', error);
                const errorMessage = error.response?.data?.error || 'Failed to create Linear connection';
                throw { success: false, error: errorMessage };
            });
    },

    validateLinearApiKey: (apiKey: string) => {
        return axios.post(`${backendBaseUrl}/linear/validate-and-fetch-teams`, { apiKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error validating Linear API key:', error);
                const errorMessage = error.response?.data?.error || 'Failed to validate API key';
                return { valid: false, error: errorMessage };
            });
    },

    deleteLinearApiKey: () => {
        return axios.delete(`${backendBaseUrl}/linear/delete-credentials`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting Linear API key:', error);
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

    setConfluenceApiKey: (email: string, baseUrl: string, apiKey: string) => {
        return axios.post(`${backendBaseUrl}/confluence/set-api-key`, { email, baseUrl, apiKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error setting Confluence API key:', error);
                const errorMessage = error.response?.data?.error || 'Failed to create Confluence connection';
                throw { success: false, error: errorMessage };
            });
    },

    validateConfluenceCredentials: (baseUrl: string, email: string, apiKey: string) => {
        return axios.post(`${backendBaseUrl}/confluence/validate-credentials`, { baseUrl, email, apiKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error validating Confluence credentials:', error);
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

    connectToCompletionSocket: async ({ onMessageReceived, onOpen, onClose, onError }: { onMessageReceived: (modelEvent: ModelEvent) => void, onOpen: () => void, onClose: () => void, onError: (error: Event) => void }) => {
        const token = await BackendProvider.requestSessionSocketToken();
        const link = `${import.meta.env.VITE_WS_BASE}/session?token=${token}`;
        console.log('Connecting to completion socket', link);
        const socket = new WebSocket(link);
        return new Connection(socket, onOpen, onClose, onError, onMessageReceived);
    },

    getUserAutomation: () => {
        return axios.get<Automation | null>(`${backendBaseUrl}/automations`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting user automation:', error);
                throw error;
            });
    },

    getUserAutomations: (page = 1, limit = 10, isActive?: boolean, search?: string) => {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('limit', limit.toString());
        if (isActive !== undefined) {
            params.append('isActive', isActive.toString());
        }
        if (search) {
            params.append('search', search);
        }

        return axios.get<AutomationsResponse>(`${backendBaseUrl}/automations?${params.toString()}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting automations:', error);
                throw error;
            });
    },

    getAutomationById: (id: string) => {
        return axios.get<Automation>(`${backendBaseUrl}/automations/${id}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting automation:', error);
                throw error;
            });
    },

    createAutomation: (name: string, inputs: AutomationInput[], output: AutomationOutput, prompt: AutomationPrompt, isActive = true) => {
        return axios.post<{ success: boolean; id: string }>(`${backendBaseUrl}/automations`,
            { name, inputs, output, prompt, isActive },
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error creating automation:', error);
                throw error;
            });
    },

    updateAutomation: (id: string, data: AutomationUpdate) => {
        return axios.patch<{ success: boolean; id: string }>(`${backendBaseUrl}/automations/${id}`,
            data,
            { withCredentials: true }
        )
            .then(response => response.data)
            .catch(error => {
                console.error('Error updating automation:', error);
                throw error;
            });
    },

    deleteAutomation: (id: string) => {
        return axios.delete<{ success: boolean; message: string }>(`${backendBaseUrl}/automations/${id}`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error deleting automation:', error);
                throw error;
            });
    },

    getRunHistory: (automationId, params) => {
        const usp = new URLSearchParams();
        if (params.page) usp.append('page', String(params.page));
        if (params.pageSize) usp.append('pageSize', String(params.pageSize));
        if (params.q) usp.append('q', params.q);
        if (params.start) usp.append('start', params.start);
        if (params.end) usp.append('end', params.end);
        if (params.status && params.status.length) usp.append('status', params.status.join(','));
        const url = `${backendBaseUrl}/run-history/${encodeURIComponent(automationId)}${usp.toString() ? `?${usp.toString()}` : ''}`;
        return axios.get<GetRunHistoryResponse>(url, { withCredentials: true })
            .then(r => r.data)
            .catch(error => {
                console.error('Error fetching run history:', error);
                throw error;
            });
    }
}

export class Connection {
    socket: WebSocket;
    onOpen: () => void;
    onClose: () => void;
    onError: (error: Event) => void;
    onMessageReceived: (modelEvent: ModelEvent) => void;

    constructor(socket: WebSocket, onOpen: () => void, onClose: () => void, onError: (error: Event) => void, onMessageReceived: (modelEvent: ModelEvent) => void) {
        this.socket = socket;
        this.onOpen = onOpen;
        this.onClose = onClose;
        this.onError = onError;
        this.onMessageReceived = onMessageReceived;
        this.socket.onopen = () => {
            this.onOpen();
        }
        this.socket.onclose = () => {
            this.onClose();
        }
        this.socket.onerror = (event) => {
            this.onError(event);
        }
        this.socket.onmessage = (event) => {
            const parsed = JSON.parse(event.data) as ModelEvent;
            this.onMessageReceived(parsed);
        }
    }

    sendMessage(message: ModelRequest) {
        console.log("Sending message", message);
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error("Socket is not open, readyState:", this.socket.readyState);
            throw new Error("Socket is not open");
        }
    }

    isReady(): boolean {
        return this.socket.readyState === WebSocket.OPEN;
    }
}
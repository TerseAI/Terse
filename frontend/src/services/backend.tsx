import axios from 'axios';
import { ModelEvent, ModelRequest } from "../shared/ModelEvents";
import { Automation, AutomationInput, AutomationOutput, AutomationPrompt, AutomationsResponse, AutomationUpdate, GithubIntegration, IntegrationsStatus, JiraIntegration, LinearIntegration, NotionDatabasesResponse, SlackChannelsResponse, SlackIntegration } from "../shared/types";
import { User } from "../types/User";
import { RunHistoryRecord } from '../shared/RunHistoryTypes';

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
     * Gets all integrations status in a single call
     */
    getIntegrationsStatus(): Promise<IntegrationsStatus>;

    /**
     * Gets the current GitHub integration
     */
    getCurrentGithubIntegration(): Promise<GithubIntegration>;

    /**
     * Requests a GitHub app installation URL
     */
    requestGitHubAppInstallationUrl(): Promise<{ installationUrl: string }>;

    /**
     * Gets the current Slack integration
     */
    getCurrentSlackIntegration(): Promise<SlackIntegration>;

    /**
     * Requests a Slack OAuth URL
     */
    requestSlackOAuthUrl(): Promise<{ url: string }>;

    /**
     * Gets the Linear API key
     */
    getLinearApiKey(): Promise<LinearIntegration>;

    /**
     * Sets the Linear API key
     */
    setLinearApiKey(apiKey: string): Promise<void>;

    /**
     * Deletes the Linear API key
     */
    deleteLinearApiKey(): Promise<void>;

    /**
     * Gets the Jira API key
     */
    getJiraApiKey(): Promise<JiraIntegration>;

    /**
     * Sets the Jira API key
     */
    setJiraApiKey(email: string, baseUrl: string, apiKey: string): Promise<void>;

    /**
     * Deletes the Jira API key
     */
    deleteJiraApiKey(): Promise<void>;

    /**
     * Requests a Gmail OAuth URL
     */
    requestGmailOAuthUrl(): Promise<{ url: string }>;

    /**
     * Deletes the Gmail integration
     */
    deleteGmailIntegration(): Promise<void>;
    /**
     * Deletes the Notion integration
     */
    deleteNotionIntegration(): Promise<void>;

    /**
     * Gets the Notion OAuth URL
     */
    requestNotionOAuthUrl(): Promise<{ url: string }>;

    /**
     * Gets available databases for a Notion integration
     */
    getNotionDatabases(integrationId: string): Promise<NotionDatabasesResponse>;

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
    getRunHistory(automationId: string, params: {
        q?: string;
        start?: string; // ISO
        end?: string;   // ISO
        status?: string[]; // ["success","failed",...]
        page?: number;
        pageSize?: number;
    }): Promise<{ items: RunHistoryRecord[]; page: number; pageSize: number; total: number }>;
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

    getIntegrationsStatus: () => {
        return axios.get(`${backendBaseUrl}/integrations/status`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting integrations status:', error);
                throw error;
            });
    },

    getCurrentGithubIntegration: () => {
        return axios.get(`${backendBaseUrl}/github/get-current-integration`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting current GitHub integration:', error);
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

    requestSlackOAuthUrl: () => {
        return axios.get(`${backendBaseUrl}/slack/get-oauth-url`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error requesting Slack OAuth URL:', error);
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

    setLinearApiKey: (apiKey: string) => {
        return axios.post(`${backendBaseUrl}/linear/set-api-key`, { apiKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error setting Linear API key:', error);
                throw error;
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

    setJiraApiKey: (email: string, baseUrl: string, apiKey: string) => {
        return axios.post(`${backendBaseUrl}/jira/set-api-key`, { email, baseUrl, apiKey }, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error setting Jira API key:', error);
                throw error;
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

    requestGmailOAuthUrl: () => {
        return axios.get(`${backendBaseUrl}/gmail/get-oauth-url`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error requesting Gmail OAuth URL:', error);
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

    requestNotionOAuthUrl: () => {
        return axios.get(`${backendBaseUrl}/notion/get-oauth-url`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error requesting Notion OAuth URL:', error);
                throw error;
            });
    },

    getNotionDatabases: (integrationId: string) => {
        return axios.get<NotionDatabasesResponse>(`${backendBaseUrl}/notion/databases?integrationId=${encodeURIComponent(integrationId)}`, { withCredentials: true })
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
        return axios.get<{ items: RunHistoryRecord[]; page: number; pageSize: number; total: number }>(url, { withCredentials: true })
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
import { ModelEvent, ModelRequest } from "../shared/ModelEvents";
import { User } from "../types/User";
import { IntegrationsStatus, GithubIntegration, LinearIntegration, JiraIntegration, SlackIntegration, GmailIntegration } from "../shared/types";
import axios from 'axios';

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
    getGithubLogInURL(): Promise<{url: string}>;

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
     * Gets the Gmail integration
     */
    getGmailIntegration(): Promise<GmailIntegration>;

    /**
     * Requests a Gmail OAuth URL
     */
    requestGmailOAuthUrl(): Promise<{ url: string }>;

    /**
     * Deletes the Gmail integration
     */
    deleteGmailIntegration(): Promise<void>;

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
        return axios.get<{url: string}>(`${backendBaseUrl}/auth/github/login-url`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting GitHub login URL:', error);
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

    getGmailIntegration: () => {
        return axios.get(`${backendBaseUrl}/gmail/get-integration`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error getting Gmail integration:', error);
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
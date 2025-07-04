import { ModelEvent, ModelRequest } from "../shared/ModelEvents";
import { User } from "../types/User";
import axios from 'axios';

const backendBaseUrl = '/api';

interface BackendService {
    /**
     * Retrieves the currently authenticated user
     */
    getCurrentUser(): Promise<User>;

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
     * Requests a GitHub app installation URL
     */
    requestGitHubAppInstallationUrl(): Promise<{ installationUrl: string }>;

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

    requestGitHubAppInstallationUrl: () => {
        return axios.get(`${backendBaseUrl}/github/installation-url`, { withCredentials: true })
            .then(response => response.data)
            .catch(error => {
                console.error('Error requesting GitHub app installation URL:', error);
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
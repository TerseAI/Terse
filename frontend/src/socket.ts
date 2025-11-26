import { io, Socket } from 'socket.io-client';
import { mutate } from 'swr';
import { BackendProvider } from './services/backend';
import type { RunHistoryModelSocketEvent } from './shared/RunHistoryTypes';
import { ModelEvent, ModelRequest } from './shared/ModelEvents';

let socket: Socket | null = null;

export async function initializeSocket() {
    // Don't initialize if already connected
    if (socket?.connected) {
        return;
    }

    // Get the session token for authentication
    const token = await BackendProvider.requestSessionSocketToken();
    
    // Socket.IO needs the full origin URL, and we specify the path via the 'path' option
    // The path will be: /api/socket.io (which the Vite proxy will forward to /socket.io on backend)
    const socketUrl = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

    console.log('Connecting to Socket.IO at:', socketUrl);
    
    socket = io(socketUrl, {
        auth: { token },
        withCredentials: true,
    });

    socket.on('connect', () => {
        console.log('Socket.IO connected');
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack,
        });
    });

    // Listen for cache invalidation events
    // SWR keys are tuples like ['runHistory', automationId, params] or ['automations', params]
    // keys: array of serialized SWR keys (JSON strings that can be parsed back to tuples)
    // tag: prefix to match against the first element of tuple keys (e.g., 'runHistory' matches ['runHistory', ...])
    // id: optional second element to match (e.g., automationId for runHistory queries)
    socket.on('invalidate', (payload: { key?: string; id?: string }) => {
        console.log('Invalidation Request received:', payload);
        const { key, id } = payload || {};
        if (key && id) {
            console.log('Invalidating key and id:', [key, id]);
            // Use matcher function to invalidate all keys that start with [key, id]
            // This matches both ['runHistory', automationId] and ['runHistory', automationId, params]
            mutate((k) => Array.isArray(k) && k[0] === key && k[1] === id);
        } else if (key) {
            console.log('Invalidating key:', key);
            // Use matcher function to invalidate all keys that start with [key]
            mutate((k) => Array.isArray(k) && k[0] === key);
        }
    });
}

// Chat event subscription management
type ChatEventCallback = (payload: RunHistoryModelSocketEvent) => void;

const chatEventCallbacks = new Map<string, Set<ChatEventCallback>>();
let chatEventListenerSetUp = false;

function setupChatEventListener() {
    if (!socket || chatEventListenerSetUp) {
        return;
    }

    socket.on('channel:chat:event', (payload: RunHistoryModelSocketEvent) => {
        const callbacks = chatEventCallbacks.get(payload.runId);
        if (callbacks) {
            callbacks.forEach((cb) => cb(payload));
        }
    });

    chatEventListenerSetUp = true;
}

export function subscribeToChatEvents(runId: string, callback: ChatEventCallback): () => void {
    if (!socket) {
        console.warn('Socket not initialized, cannot subscribe to chat events');
        return () => {};
    }

    // Set up the listener if not already done
    setupChatEventListener();

    if (!chatEventCallbacks.has(runId)) {
        chatEventCallbacks.set(runId, new Set());
    }

    chatEventCallbacks.get(runId)!.add(callback);

    // Return unsubscribe function
    return () => {
        const callbacks = chatEventCallbacks.get(runId);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                chatEventCallbacks.delete(runId);
            }
        }
    };
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

export function sendChatMessage(runId: string | null, message: ModelRequest): void {
    if (!socket || !socket.connected) {
        console.warn('Socket not connected, cannot send message');
        return;
    }
    socket.emit('channel:chat:message', { runId, message });
}

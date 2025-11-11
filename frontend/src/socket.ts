import { io, Socket } from 'socket.io-client';
import { mutate } from 'swr';
import { BackendProvider } from './services/backend';

let socket: Socket | null = null;

export async function initializeSocket() {
    console.log("Initializing socket");
    // Don't initialize if already connected
    if (socket?.connected) {
        return;
    }

    // Get the session token for authentication
    const token = await BackendProvider.requestSessionSocketToken();
    
    // Socket.IO connection setup
    const wsBase = import.meta.env.VITE_WS_BASE || '';
    
    // Socket.IO needs the full origin URL, and we specify the path via the 'path' option
    // The path will be: /api/socket.io (which the Vite proxy will forward to /socket.io on backend)
    const socketUrl = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;
    const socketPath = `${wsBase}/socket.io`;
    
    console.log('Connecting to Socket.IO at:', socketUrl, 'with path:', socketPath);
    
    socket = io(socketUrl, {
        path: socketPath,
        transports: ['websocket'],
        auth: { token }, // JWT token for authentication
        withCredentials: true, // Include cookies
    });

    socket.on('connect', () => {
        console.log('Socket.IO connected');
    });

    socket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
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

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
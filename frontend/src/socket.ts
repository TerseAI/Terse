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
    const wsBase = import.meta.env.VITE_WS_BASE || '/api';
    
    // Socket.IO needs the full origin URL, and we specify the path via the 'path' option
    // The path will be: /api/socket.io (which the Vite proxy will forward to /socket.io on backend)
    const socketUrl = window.location.origin;
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
    socket.on('invalidate', (payload: { keys?: string[]; tag?: string; id?: string }) => {
        console.log('Invalidation received:', payload);
        const { keys = [], tag, id } = payload || {};
        if (keys.length) {
            // Parse serialized keys back to tuples and invalidate
            keys.forEach((serializedKey) => {
                try {
                    const key = JSON.parse(serializedKey);
                    mutate(key);
                } catch (e) {
                    // If parsing fails, try as-is (might be a string key)
                    mutate(serializedKey);
                }
            });
        } else if (tag) {
            // Match against first element of tuple keys
            // If id is provided, also match on the second element (e.g., automationId)
            mutate((key: any) => {
                if (Array.isArray(key) && key.length > 0) {
                    const tagMatches = key[0] === tag;
                    if (id !== undefined) {
                        // Match on both tag and id (second element)
                        return tagMatches && key.length > 1 && key[1] === id;
                    }
                    return tagMatches;
                }
                // Fallback for string keys
                return typeof key === 'string' && key.includes(tag);
            });
        }
    });
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
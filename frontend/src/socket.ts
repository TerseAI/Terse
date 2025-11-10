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
    socket.on('invalidate', (payload: { keys?: string[]; tag?: string }) => {
        const { keys = [], tag } = payload || {};
        if (keys.length) {
            keys.forEach((k) => mutate(k));
        } else if (tag) {
            mutate((k: any) => typeof k === 'string' && k.includes(tag));
        }
    });
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
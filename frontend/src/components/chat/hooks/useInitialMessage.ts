import { useEffect, useRef } from 'react';
import { ModelRequest } from '../../../shared/ModelEvents';

interface UseInitialMessageOptions {
    connection: {
        isConnected: boolean;
        connection: {
            sendMessage: (message: ModelRequest) => void;
            isReady: () => boolean;
            socket: WebSocket;
        } | null;
    };
    message: ModelRequest;
    enabled?: boolean;
}

export function useInitialMessage({ connection, message, enabled = true }: UseInitialMessageOptions) {
    const hasSentRef = useRef(false);

    useEffect(() => {
        if (!enabled || hasSentRef.current) return;

        // Only send the initial message when both connection exists and is connected
        if (connection.isConnected && connection.connection) {
            // Add a small delay to ensure the socket is fully ready
            const timer = setTimeout(() => {
                if (connection.connection?.isReady() && !hasSentRef.current) {
                    console.log("✅ Connection ready, sending initial message");
                    try {
                        connection.connection.sendMessage(message);
                        hasSentRef.current = true; // Mark as sent to prevent re-sending
                    } catch (error) {
                        console.error("Failed to send initial message:", error);
                    }
                } else {
                    console.log("⏳ Socket not ready yet, readyState:", connection.connection?.socket.readyState);
                }
            }, 100); // Small delay to ensure socket is fully ready

            return () => clearTimeout(timer);
        } else {
            console.log("⏳ Waiting for connection to be ready...", { 
                isConnected: connection.isConnected, 
                hasConnection: !!connection.connection 
            });
        }
    }, [connection.isConnected, connection.connection, enabled]);

    // Reset the sent flag when the connection changes (for reconnection scenarios)
    useEffect(() => {
        if (!connection.isConnected) {
            hasSentRef.current = false;
        }
    }, [connection.isConnected]);
} 
import { useEffect, useRef } from 'react';
import { type ModelRequest } from '../../../shared/ModelEvents';

interface UseInitialMessageOptions {
    sendMessage: (message: ModelRequest) => void;
    message: ModelRequest;
    enabled?: boolean;
    isConnected?: boolean;
}

export function useInitialMessage({ sendMessage, message, enabled = true, isConnected = true }: UseInitialMessageOptions) {
    const hasSentRef = useRef(false);

    useEffect(() => {
        if (!enabled || hasSentRef.current) return;

        if (isConnected) {
            // Add a small delay to ensure the socket is fully ready
            const timer = setTimeout(() => {
                if (!hasSentRef.current) {
                    try {
                        sendMessage(message);
                        hasSentRef.current = true; // Mark as sent to prevent re-sending
                    } catch (error) {
                        console.error("Failed to send initial message:", error);
                    }
                }
            }, 100); // Small delay to ensure socket is fully ready

            return () => clearTimeout(timer);
        } else {
            console.log("⏳ Waiting for connection to be ready...", { 
                isConnected
            });
        }
    }, [isConnected, enabled, sendMessage, message]);

    // Reset the sent flag when the connection changes (for reconnection scenarios)
    useEffect(() => {
        if (!isConnected) {
            hasSentRef.current = false;
        }
    }, [isConnected]);
} 

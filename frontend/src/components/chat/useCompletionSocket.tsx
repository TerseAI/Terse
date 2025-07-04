import { useRef, useState } from "react";
import { useEffect } from "react";
import { BackendProvider, Connection } from "../../services/backend";
import { ChangedItem, ModelEvent } from "../../shared/ModelEvents";


export enum ConnectionType {
    MainChat = "main_chat",
    OnboardingChat = "onboarding_chat",
    ImportChat = "import_chat",
}

type UseCompletionSocketOptions = {
    connectionType: ConnectionType;
    onDelta: (delta: { delta: string; step_id: string }) => void;
    onToolCall: (toolCall: { summary: string; step_id: string; parameters: string }) => void;
    onToolCallComplete: (toolCallComplete: { tool_name: string; status: string; step_id: string; changed_items: ChangedItem[] }) => void;
    onToolApprovalRequest: (req: { step_id: string; name: string; arguments: string }) => void;
    onFailure: (failure: { error: string }) => void;
    onNaturalStop: () => void;

    // optional
    onOpen?: () => void;
};

export function useCompletionSocket(options: UseCompletionSocketOptions) {
    const { onDelta, onToolCall, onToolCallComplete, onToolApprovalRequest, onFailure, onNaturalStop } = options;

    const onDeltaRef = useRef(onDelta);
    const onToolCallRef = useRef(onToolCall);
    const onToolCallCompleteRef = useRef(onToolCallComplete);
    const onToolApprovalRequestRef = useRef(onToolApprovalRequest);
    const onFailureRef = useRef(onFailure);
    const onNaturalStopRef = useRef(onNaturalStop);
    const [connection, setConnection] = useState<Connection | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    // Keep refs updated with latest versions
    useEffect(() => {
        onDeltaRef.current = onDelta;
        onToolCallRef.current = onToolCall;
        onToolCallCompleteRef.current = onToolCallComplete;
        onToolApprovalRequestRef.current = onToolApprovalRequest;
        onFailureRef.current = onFailure;
    }, [onDelta, onToolCall, onToolCallComplete, onToolApprovalRequest, onFailure]);

    // Connect once on mount
    useEffect(() => {
        let conn: Connection | null = null;
        let isMounted = true;

        let connectionRequst = options.connectionType === ConnectionType.MainChat 
            ? BackendProvider.connectToCompletionSocket 
            : BackendProvider.connectToCompletionSocket;

        const setupConnection = async () => {
            try {
                const newConn = await connectionRequst({
                    onMessageReceived: (message: ModelEvent) => {
                        switch (message.type) {
                            case 'TextDelta':
                                onDeltaRef.current({ delta: message.delta, step_id: message.step_id });
                                break;
                            case 'ToolCall':
                                console.log('Socket has just sent ToolCall', message);
                                onToolCallRef.current({ summary: message.summary, step_id: message.step_id, parameters: message.parameters });
                                break;
                            case 'ToolCallComplete':
                                console.log('Socket has just sent ToolCallComplete', message);
                                onToolCallCompleteRef.current({
                                    tool_name: message.tool_name,
                                    status: message.status,
                                    step_id: message.step_id,
                                    changed_items: message.changed_items,
                                });
                                break;
                            case 'ToolApprovalRequest':
                                onToolApprovalRequestRef.current({
                                    step_id: message.step_id,
                                    name: message.name,
                                    arguments: message.arguments,
                                });
                                break;
                            case 'Failure':
                                onFailureRef.current({ error: message.error });
                                break;
                            case 'NaturalStop':
                                onNaturalStopRef.current();
                                break;
                        }
                    },
                    onOpen: () => {
                        console.log('✅ Connected to completion socket');
                        setIsConnected(true);
                        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
                        options.onOpen?.();
                    },
                    onClose: () => {
                        console.log('❌ Disconnected from completion socket');
                        setIsConnected(false);
                        
                        // Attempt to reconnect if component is still mounted
                        if (isMounted && reconnectAttemptsRef.current < maxReconnectAttempts) {
                            reconnectAttemptsRef.current++;
                            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000); // Exponential backoff, max 30s
                            console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
                            
                            reconnectTimeoutRef.current = window.setTimeout(() => {
                                if (isMounted) {
                                    setupConnection();
                                }
                            }, delay);
                        }
                    },
                    onError: (e) => console.error('💥 Socket error', e),
                });

                conn = newConn;
                if (isMounted) {
                    setConnection(newConn);
                }
            } catch (error) {
                console.error('Failed to establish WebSocket connection:', error);
                // Don't attempt to reconnect on initial connection failure
            }
        };

        setupConnection();

        return () => {
            isMounted = false;
            
            // Clear reconnect timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            
            if (conn) {
                setIsConnected(false);
                console.log('👋 Closing connection');
                conn.socket.close();
            }
        };
    }, []); // important: no dependencies

    return { connection, isConnected };
}
import { useRef, useState, useEffect } from "react";
import { type ToolCall, type ToolCallComplete, type TextDelta, type Failure, type ModelRequest } from "../../../shared/ModelEvents";
import type { RunHistoryModelSocketEvent } from "../../../shared/RunHistoryTypes";

export type ChatEventSubscription = (callback: (payload: RunHistoryModelSocketEvent) => void) => () => void;

export type UseCompletionSocketOptions = {
    subscribeToEvents?: ChatEventSubscription | null;
    sendMessage: (message: ModelRequest) => void;
    onDelta: (delta: TextDelta) => void;
    onToolCall: (toolCall: ToolCall) => void;
    onToolCallComplete: (toolCallComplete: ToolCallComplete) => void;
    onFailure: (failure: Failure) => void;
    onNaturalStop: () => void;
};

export function useCompletionSocket(options: UseCompletionSocketOptions) {
    const { subscribeToEvents, sendMessage, onDelta, onToolCall, onToolCallComplete, onFailure, onNaturalStop } = options;

    const onDeltaRef = useRef(onDelta);
    const onToolCallRef = useRef(onToolCall);
    const onToolCallCompleteRef = useRef(onToolCallComplete);
    const onFailureRef = useRef(onFailure);
    const onNaturalStopRef = useRef(onNaturalStop);
    
    // For now we assume connected, or we could expose socket connection state globally
    const [isConnected] = useState(true);

    // Keep refs updated with latest versions
    useEffect(() => {
        onDeltaRef.current = onDelta;
        onToolCallRef.current = onToolCall;
        onToolCallCompleteRef.current = onToolCallComplete;
        onFailureRef.current = onFailure;
        onNaturalStopRef.current = onNaturalStop;
    }, [onDelta, onToolCall, onToolCallComplete, onFailure, onNaturalStop]);

    // Subscribe to events
    useEffect(() => {
        if (!subscribeToEvents) return;

        const unsubscribe = subscribeToEvents((payload) => {
            const message = payload.runHistoryModelEvent;
            
            switch (message.type) {
                case 'TextDelta':
                    onDeltaRef.current(message);
                    break;
                case 'ToolCall':
                    onToolCallRef.current(message);
                    break;
                case 'ToolCallComplete':
                    onToolCallCompleteRef.current(message);
                    break;
                case 'Failure':
                    onFailureRef.current(message);
                    break;
                case 'NaturalStop':
                    onNaturalStopRef.current();
                    break;
            }
        });

        return () => {
            unsubscribe();
        };
    }, [subscribeToEvents]);

    return { sendMessage, isConnected };
}

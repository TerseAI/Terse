import { useRef, useState, useEffect } from "react";
import { type ToolCall, type ToolCallComplete, type TextDelta, type Failure, type ModelRequest, FilterResult, type ToolApprovalRequest, ToolApprovalResponse, type ModelEvent, type ChatSnippetPayload } from "../../../shared/ModelEvents";

export type ChatEventPayload = {
    runHistoryModelEvent: ModelEvent;
};

export type ChatEventSubscription = (callback: (payload: ChatEventPayload) => void) => () => void;

export type UseCompletionSocketOptions = {
    subscribeToEvents?: ChatEventSubscription | null;
    sendMessage: (message: ModelRequest) => void;
    onDelta: (delta: TextDelta) => void;
    onToolCall: (toolCall: ToolCall) => void;
    onToolCallComplete: (toolCallComplete: ToolCallComplete) => void;
    onFailure: (failure: Failure) => void;
    onNaturalStop: () => void;
    onFilterResult: (filterResult: FilterResult) => void;
    onThinking: (stepId: string) => void;
    onToolApprovalRequest?: (request: ToolApprovalRequest) => void;
    onToolApprovalResponse?: (response: ToolApprovalResponse) => void;
    onSnippet?: (snippet: ChatSnippetPayload) => void;
};

export function useCompletionSocket(options: UseCompletionSocketOptions) {
    const { subscribeToEvents, sendMessage, onDelta, onToolCall, onToolCallComplete, onFailure, onNaturalStop, onFilterResult, onThinking, onToolApprovalRequest, onToolApprovalResponse, onSnippet } = options;

    const onDeltaRef = useRef(onDelta);
    const onToolCallRef = useRef(onToolCall);
    const onToolCallCompleteRef = useRef(onToolCallComplete);
    const onFailureRef = useRef(onFailure);
    const onNaturalStopRef = useRef(onNaturalStop);
    const onFilterResultRef = useRef(onFilterResult);
    const onThinkingRef = useRef(onThinking);
    const onToolApprovalRequestRef = useRef(onToolApprovalRequest);
    const onToolApprovalResponseRef = useRef(onToolApprovalResponse);
    const onSnippetRef = useRef(onSnippet);
    // For now we assume connected, or we could expose socket connection state globally
    const [isConnected] = useState(true);

    // Keep refs updated with latest versions
    useEffect(() => {
        onDeltaRef.current = onDelta;
        onToolCallRef.current = onToolCall;
        onToolCallCompleteRef.current = onToolCallComplete;
        onFailureRef.current = onFailure;
        onNaturalStopRef.current = onNaturalStop;
        onFilterResultRef.current = onFilterResult;
        onThinkingRef.current = onThinking;
        onToolApprovalRequestRef.current = onToolApprovalRequest;
        onToolApprovalResponseRef.current = onToolApprovalResponse;
        onSnippetRef.current = onSnippet;
    }, [onDelta, onToolCall, onToolCallComplete, onFailure, onNaturalStop, onFilterResult, onThinking, onToolApprovalRequest, onSnippet]);

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
                case 'FilterResult':
                    onFilterResultRef.current(message);
                    break;
                case 'Thinking':
                    onThinkingRef.current(message.step_id);
                    break;
                case 'ToolApprovalRequest':
                    onToolApprovalRequestRef.current?.(message);
                    break;
                case 'ToolApprovalResponse':
                    onToolApprovalResponseRef.current?.(message);
                    break;
                case 'Snippet':
                    console.log('Snippet event received', message.snippet);
                    onSnippetRef.current?.(message.snippet);
                    break;
            }
        });

        return () => {
            unsubscribe();
        };
    }, [subscribeToEvents]);

    return { sendMessage, isConnected };
}

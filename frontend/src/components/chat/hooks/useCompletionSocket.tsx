import { useCallback, useEffect, useRef, useState } from "react"

import {
    type Cancelled,
    type ChatSnippet,
    FilterResult,
    type ModelEvent,
    type ModelRequest,
    type RunError,
    type TextDelta,
    Thinking,
    type ToolApprovalRequest,
    ToolApprovalResponse,
    type ToolCall,
    type ToolCallComplete,
    type ToolCallGenerating
} from "../../../shared/ModelEvents"

export type ChatEventPayload = {
    runHistoryModelEvent: ModelEvent & { stream_seq?: number }
}

export type ChatEventSubscription = (callback: (payload: ChatEventPayload) => void) => () => void

export type TextStreamGapReason = "delta_index" | "stream_seq"

export type UseCompletionSocketOptions = {
    subscribeToEvents?: ChatEventSubscription | null
    sendMessage: (message: ModelRequest) => void
    onDelta: (delta: TextDelta) => void
    onToolCallGenerating: (toolCallGenerating: ToolCallGenerating) => void
    onToolCall: (toolCall: ToolCall) => void
    onToolCallComplete: (toolCallComplete: ToolCallComplete) => void
    onNaturalStop: () => void
    onFilterResult: (filterResult: FilterResult) => void
    onThinking: (thinking: Thinking) => void
    onToolApprovalRequest?: (request: ToolApprovalRequest) => void
    onToolApprovalResponse?: (response: ToolApprovalResponse) => void
    onSnippet?: (snippet: ChatSnippet) => void
    onRunError?: (event: RunError) => void
    onCancelled?: (event: Cancelled) => void
}

export function useCompletionSocket(options: UseCompletionSocketOptions) {
    const {
        subscribeToEvents,
        sendMessage,
        onDelta,
        onToolCallGenerating,
        onToolCall,
        onToolCallComplete,
        onNaturalStop,
        onFilterResult,
        onThinking,
        onToolApprovalRequest,
        onToolApprovalResponse,
        onSnippet,
        onRunError,
        onCancelled
    } = options

    const onDeltaRef = useRef(onDelta)
    const onToolCallGeneratingRef = useRef(onToolCallGenerating)
    const onToolCallRef = useRef(onToolCall)
    const onToolCallCompleteRef = useRef(onToolCallComplete)
    const onNaturalStopRef = useRef(onNaturalStop)
    const onFilterResultRef = useRef(onFilterResult)
    const onThinkingRef = useRef(onThinking)
    const onToolApprovalRequestRef = useRef(onToolApprovalRequest)
    const onToolApprovalResponseRef = useRef(onToolApprovalResponse)
    const onSnippetRef = useRef(onSnippet)
    const onRunErrorRef = useRef(onRunError)
    const onCancelledRef = useRef(onCancelled)
    // For now we assume connected, or we could expose socket connection state globally
    const [isConnected] = useState(true)

    // Keep refs updated with latest versions
    useEffect(() => {
        onDeltaRef.current = onDelta
        onToolCallGeneratingRef.current = onToolCallGenerating
        onToolCallRef.current = onToolCall
        onToolCallCompleteRef.current = onToolCallComplete
        onNaturalStopRef.current = onNaturalStop
        onFilterResultRef.current = onFilterResult
        onThinkingRef.current = onThinking
        onToolApprovalRequestRef.current = onToolApprovalRequest
        onToolApprovalResponseRef.current = onToolApprovalResponse
        onSnippetRef.current = onSnippet
        onRunErrorRef.current = onRunError
        onCancelledRef.current = onCancelled
    }, [onDelta, onToolCallGenerating, onToolCall, onToolCallComplete, onNaturalStop, onFilterResult, onThinking, onToolApprovalRequest, onToolApprovalResponse, onSnippet, onRunError, onCancelled])

    // Subscribe to events
    useEffect(() => {
        if (!subscribeToEvents) {
            return
        }
        const unsubscribe = subscribeToEvents(payload => {
            const message = payload.runHistoryModelEvent
            switch (message.type) {
                case "TextDelta":
                    onDeltaRef.current(message)
                    break
                case "ToolCallGenerating":
                    onToolCallGeneratingRef.current(message)
                    break
                case "ToolCall":
                    onToolCallRef.current(message)
                    break
                case "ToolCallComplete":
                    onToolCallCompleteRef.current(message)
                    break
                case "NaturalStop":
                    onNaturalStopRef.current()
                    break
                case "FilterResult":
                    onFilterResultRef.current(message)
                    break
                case "Thinking":
                    onThinkingRef.current(message)
                    break
                case "ToolApprovalRequest":
                    onToolApprovalRequestRef.current?.(message)
                    break
                case "ToolApprovalResponse":
                    onToolApprovalResponseRef.current?.(message)
                    break
                case "Snippet":
                    onSnippetRef.current?.({
                        ...message.snippet,
                        timestamp: message.snippet.timestamp ?? message.timestamp
                    })
                    break
                case "UserMessage":
                    // No-op: user turns are created locally via addUserTurn.
                    break
                case "RunError":
                    onRunErrorRef.current?.(message)
                    break
                case "Cancelled":
                    onCancelledRef.current?.(message)
                    break
                default:
                    // Exhaustive switch guard: if ModelEvent gains a new variant,
                    // TypeScript will fail here until we handle it explicitly.
                    const exhaustiveCheck: never = message
                    console.warn("Unhandled chat event", exhaustiveCheck)
            }
        })

        return () => {
            console.log("Cleaning up event subscription")
            unsubscribe()
        }
    }, [subscribeToEvents])

    const sendMessageWithLogging = useCallback(
        (message: ModelRequest) => {
            console.log("Sending message through socket hook", { type: message.type })
            sendMessage(message)
        },
        [sendMessage]
    )

    return { sendMessage: sendMessageWithLogging, isConnected }
}

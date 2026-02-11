import { useEffect, useRef, useState } from "react"

import {
    type ChatSnippetPayload,
    type Failure,
    FilterResult,
    type ModelEvent,
    type ModelRequest,
    type RunError,
    type TextDelta,
    type ToolApprovalRequest,
    ToolApprovalResponse,
    type ToolCall,
    type ToolCallComplete,
    type ToolCallGenerating
} from "../../../shared/ModelEvents"

export type ChatEventPayload = {
    runHistoryModelEvent: ModelEvent
}

export type ChatEventSubscription = (callback: (payload: ChatEventPayload) => void) => () => void

export type UseCompletionSocketOptions = {
    subscribeToEvents?: ChatEventSubscription | null
    sendMessage: (message: ModelRequest) => void
    onDelta: (delta: TextDelta) => void
    onToolCallGenerating: (toolCallGenerating: ToolCallGenerating) => void
    onToolCall: (toolCall: ToolCall) => void
    onToolCallComplete: (toolCallComplete: ToolCallComplete) => void
    onFailure: (failure: Failure) => void
    onNaturalStop: () => void
    onFilterResult: (filterResult: FilterResult) => void
    onThinking: (stepId: string) => void
    onToolApprovalRequest?: (request: ToolApprovalRequest) => void
    onToolApprovalResponse?: (response: ToolApprovalResponse) => void
    onSnippet?: (snippet: ChatSnippetPayload) => void
    onRunError?: (event: RunError) => void
}

export function useCompletionSocket(options: UseCompletionSocketOptions) {
    const {
        subscribeToEvents,
        sendMessage,
        onDelta,
        onToolCallGenerating,
        onToolCall,
        onToolCallComplete,
        onFailure,
        onNaturalStop,
        onFilterResult,
        onThinking,
        onToolApprovalRequest,
        onToolApprovalResponse,
        onSnippet,
        onRunError
    } = options

    const onDeltaRef = useRef(onDelta)
    const onToolCallGeneratingRef = useRef(onToolCallGenerating)
    const onToolCallRef = useRef(onToolCall)
    const onToolCallCompleteRef = useRef(onToolCallComplete)
    const onFailureRef = useRef(onFailure)
    const onNaturalStopRef = useRef(onNaturalStop)
    const onFilterResultRef = useRef(onFilterResult)
    const onThinkingRef = useRef(onThinking)
    const onToolApprovalRequestRef = useRef(onToolApprovalRequest)
    const onToolApprovalResponseRef = useRef(onToolApprovalResponse)
    const onSnippetRef = useRef(onSnippet)
    const onRunErrorRef = useRef(onRunError)
    // For now we assume connected, or we could expose socket connection state globally
    const [isConnected] = useState(true)

    // Keep refs updated with latest versions
    useEffect(() => {
        onDeltaRef.current = onDelta
        onToolCallGeneratingRef.current = onToolCallGenerating
        onToolCallRef.current = onToolCall
        onToolCallCompleteRef.current = onToolCallComplete
        onFailureRef.current = onFailure
        onNaturalStopRef.current = onNaturalStop
        onFilterResultRef.current = onFilterResult
        onThinkingRef.current = onThinking
        onToolApprovalRequestRef.current = onToolApprovalRequest
        onToolApprovalResponseRef.current = onToolApprovalResponse
        onSnippetRef.current = onSnippet
        onRunErrorRef.current = onRunError
    }, [onDelta, onToolCallGenerating, onToolCall, onToolCallComplete, onFailure, onNaturalStop, onFilterResult, onThinking, onToolApprovalRequest, onSnippet, onRunError])

    // Subscribe to events
    useEffect(() => {
        if (!subscribeToEvents) {
            console.log("[useCompletionSocket] No subscribeToEvents provided, skipping subscription")
            return
        }

        console.log("[useCompletionSocket] Setting up event subscription")
        const unsubscribe = subscribeToEvents(payload => {
            const message = payload.runHistoryModelEvent
            console.log("[useCompletionSocket] Event received:", message.type)

            // Ensure epoch-ms timestamp is present, falling back to client time.
            message.timestamp = message.timestamp ?? Date.now()

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
                case "Failure":
                    onFailureRef.current(message)
                    break
                case "NaturalStop":
                    onNaturalStopRef.current()
                    break
                case "FilterResult":
                    onFilterResultRef.current(message)
                    break
                case "Thinking":
                    onThinkingRef.current(message.step_id)
                    break
                case "ToolApprovalRequest":
                    onToolApprovalRequestRef.current?.(message)
                    break
                case "ToolApprovalResponse":
                    onToolApprovalResponseRef.current?.(message)
                    break
                case "Snippet":
                    console.log("Snippet event received", message.snippet)
                    onSnippetRef.current?.({ ...message.snippet, timestamp: message.timestamp })
                    break
                case "RunError":
                    onRunErrorRef.current?.({ error: message.error, ...(message.code && { code: message.code }) })
                    break
                default:
                    console.warn("[useCompletionSocket] Unknown event type:", message.type)
            }
        })

        return () => {
            console.log("[useCompletionSocket] Cleaning up event subscription")
            unsubscribe()
        }
    }, [subscribeToEvents])

    return { sendMessage, isConnected }
}

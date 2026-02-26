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
    onNaturalStop: () => void
    onFilterResult: (filterResult: FilterResult) => void
    onThinking: (thinking: Thinking) => void
    onToolApprovalRequest?: (request: ToolApprovalRequest) => void
    onToolApprovalResponse?: (response: ToolApprovalResponse) => void
    onSnippet?: (snippet: ChatSnippet) => void
    onRunError?: (event: RunError) => void
    onCancelled?: (event: Cancelled) => void
}

const LOG_PREFIX = "[useCompletionSocket]"

function logCompletionSocket(message: string, details?: Record<string, unknown>): void {
    if (details) {
        console.log(LOG_PREFIX, message, details)
        return
    }
    console.log(LOG_PREFIX, message)
}

function getSocketEventDetails(message: ModelEvent): Record<string, unknown> {
    const details: Record<string, unknown> = {
        type: message.type,
        timestamp: message.timestamp ?? null
    }
    if ("step_id" in message) {
        details.stepId = message.step_id
    }
    if ("tool_name" in message) {
        details.toolName = message.tool_name
    }
    if ("summary" in message) {
        details.summary = message.summary
    }
    if (message.type === "TextDelta") {
        details.deltaLength = message.delta.length
    }
    if (message.type === "Snippet") {
        details.snippetType = message.snippet.type
    }
    if (message.type === "ToolApprovalResponse") {
        details.approved = message.approved
    }
    if (message.type === "Cancelled") {
        details.reason = message.reason ?? null
    }
    return details
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
            logCompletionSocket("No subscribeToEvents provided, skipping subscription")
            return
        }

        logCompletionSocket("Setting up event subscription")
        const unsubscribe = subscribeToEvents(payload => {
            const message = payload.runHistoryModelEvent
            logCompletionSocket("Event received", getSocketEventDetails(message))

            // Normalize timestamps to epoch-ms for stable ordering in the chat timeline.
            const originalTimestamp = message.timestamp
            if (typeof message.timestamp === "string") {
                const parsed = Date.parse(message.timestamp)
                message.timestamp = Number.isNaN(parsed) ? Date.now() : parsed
            } else {
                message.timestamp = message.timestamp ?? Date.now()
            }
            if (originalTimestamp !== message.timestamp) {
                logCompletionSocket("Normalized event timestamp", {
                    type: message.type,
                    originalTimestamp: originalTimestamp ?? null,
                    normalizedTimestamp: message.timestamp
                })
            }

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
                case "RunError":
                    onRunErrorRef.current?.(message)
                    break
                case "Cancelled":
                    onCancelledRef.current?.(message)
                    break
                default:
                    console.warn(LOG_PREFIX, "Unknown event type:", message.type)
            }
        })

        return () => {
            logCompletionSocket("Cleaning up event subscription")
            unsubscribe()
        }
    }, [subscribeToEvents])

    const sendMessageWithLogging = useCallback(
        (message: ModelRequest) => {
            logCompletionSocket("Sending message through socket hook", { type: message.type })
            sendMessage(message)
        },
        [sendMessage]
    )

    return { sendMessage: sendMessageWithLogging, isConnected }
}

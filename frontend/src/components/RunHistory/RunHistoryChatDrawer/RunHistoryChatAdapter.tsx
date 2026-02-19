import { useMemo } from "react"

import { Chat } from "@/components/chat/Chat"
import { Turn } from "@/components/chat/Turn"
import { type ChatEventSubscription } from "@/components/chat/hooks/useCompletionSocket"
import { filterOutThinkingOnlyTurns } from "@/components/chat/utils/turnUtils"
import { useChatHistory } from "@/hooks/api/useChatHistory"
import { FilterResult, ModelEvent, ModelRequest, RunError, TextDelta, ToolApprovalResponse, ToolCall, ToolCallComplete, UserMessage } from "@/shared/ModelEvents"
import { RunHistoryStatus } from "@/shared/RunHistoryTypes"
import type { RunHistoryModelSocketEvent } from "@/shared/RunHistoryTypes"
import { sendChatMessage, sendToolApprovalResponse, subscribeToChatEvents } from "@/socket"

type RunHistoryChatAdapterProps = {
    runId: string
    status: RunHistoryStatus
    children?: (props: {
        initialTurns: Turn[]
        isLoading: boolean
        runId: string
        startTimestamp?: string
        endTimestamp?: string
        subscribeToEvents?: ChatEventSubscription | null
        sendMessage: (message: ModelRequest) => void
        handleApprove: (stepId: string) => void
        handleReject: (stepId: string) => void
        currentStatus: RunHistoryStatus
    }) => React.ReactNode
}

export default function RunHistoryChatAdapter({ runId, status, children }: RunHistoryChatAdapterProps) {
    // Fetch History (API)
    const { events, isLoading, startTimestamp, endTimestamp } = useChatHistory(runId)

    // Parse server ISO timestamps to epoch ms for chronological ordering
    const historicalEvents = useMemo(
        () =>
            events.map(event => ({
                ...event,
                timestamp: event.timestamp ? new Date(event.timestamp).getTime() : undefined,
                isHistorical: true
            })),
        [events]
    )

    // Use API status if available, otherwise fall back to prop status
    const currentStatus = status

    // Convert to Turns
    const turns = useMemo(() => convertRunHistoryEventsToTurns(historicalEvents), [historicalEvents])

    // Create subscription function for run history — subscribe whenever runId is valid.
    // We don't gate on isActiveRun/status because the status in the drawer is a stale
    // snapshot from when the drawer was opened. The server won't send events for
    // completed runs anyway, so subscribing for non-active runs is harmless.
    const subscribeToEvents: ChatEventSubscription | null = useMemo(() => {
        if (!runId) return null

        return (callback: (payload: RunHistoryModelSocketEvent) => void) => {
            return subscribeToChatEvents(runId, callback)
        }
    }, [runId])

    // Create send message function for run history
    const sendMessage = (message: ModelRequest) => {
        sendChatMessage(runId, message)
    }

    const handleApprove = (stepId: string) => {
        sendToolApprovalResponse(runId, stepId, true)
    }

    const handleReject = (stepId: string) => {
        sendToolApprovalResponse(runId, stepId, false)
    }

    if (children) {
        return <>{children({ initialTurns: turns, isLoading, runId, startTimestamp, endTimestamp, subscribeToEvents, sendMessage, currentStatus, handleApprove, handleReject })}</>
    }

    return (
        <Chat
            initialTurns={turns}
            subscribeToEvents={subscribeToEvents}
            sendMessage={sendMessage}
            addUserTurnsLocally={true}
            onHandleApprove={handleApprove}
            onHandleReject={handleReject}
            EmptyContentPlaceholder={
                isLoading ? <div className="p-4 text-center text-muted-foreground">Loading history...</div> : <div className="p-4 text-center text-muted-foreground">No events found</div>
            }
        />
    )
}

export function convertRunHistoryEventsToTurns(events: (ModelEvent & { timestamp?: number })[]): Turn[] {
    const turns: Turn[] = []
    const stepBuffers = new Map<string, string>()
    /** Fallback counter when events lack a timestamp (shouldn't happen with server-provided data). */
    let eventOrder = 0

    // Helper to find or create the appropriate turn
    const getOrCreateTurn = (role: "assistant" | "user", step_id: string): Turn => {
        const lastTurn = turns[turns.length - 1]

        // If last turn matches role and (for assistant) step_id, use it
        if (lastTurn && lastTurn.role === role && (role === "user" || lastTurn.step_id === step_id)) {
            return lastTurn
        }

        // Create new turn
        const newTurn: Turn = {
            role,
            text: "",
            function_calls: [],
            step_id,
            isGenerating: role === "assistant"
        }
        turns.push(newTurn)
        return newTurn
    }

    // Track which step_ids have been completed (have ToolCallComplete or NaturalStop)
    const completedStepIds = new Set<string>()

    events.forEach(event => {
        switch (event.type) {
            case "UserMessage": {
                const e = event as UserMessage
                turns.push({
                    role: "user",
                    text: e.message,
                    function_calls: [],
                    step_id: "user",
                    isGenerating: false,
                    disableAnimation: true
                })
                break
            }
            case "FilterResult": {
                const e = event as FilterResult
                turns.push({
                    role: "assistant",
                    text: "",
                    function_calls: [],
                    step_id: "filter",
                    isGenerating: true,
                    filter_result: {
                        isRelevant: e.isRelevant,
                        reason: e.reason,
                        confidence: e.confidence
                    },
                    disableAnimation: true
                })
                break
            }
            case "TextDelta": {
                const e = event as TextDelta
                const step_id = e.step_id
                const existing = stepBuffers.get(step_id) ?? ""
                const newText = existing + e.delta
                stepBuffers.set(step_id, newText)

                const turn = getOrCreateTurn("assistant", step_id)
                turn.text = newText
                turn.isGenerating = true
                turn.disableAnimation = true
                break
            }
            case "ToolCall": {
                const e = event as ToolCall
                const step_id = e.step_id

                const turn = getOrCreateTurn("assistant", step_id)
                turn.disableAnimation = true

                const existingCall = turn.function_calls.find(c => c.id === step_id)
                if (!existingCall) {
                    turn.function_calls.push({
                        id: step_id,
                        name: e.summary,
                        timestamp: event.timestamp ?? eventOrder++,
                        // For historical events, start with isRunning: false
                        // since we'll see ToolCallComplete soon
                        isRunning: false,
                        parameters: e.parameters,
                        isWaitingForUserInput: false
                    })
                } else {
                    existingCall.parameters = e.parameters
                }
                turn.isGenerating = true
                break
            }
            case "ToolCallComplete": {
                const e = event as ToolCallComplete
                const step_id = e.step_id
                completedStepIds.add(step_id)
                let found = false
                // Find the call in any turn
                for (const t of turns) {
                    const fc = t.function_calls.find(c => c.id === step_id)
                    if (fc) {
                        fc.isRunning = false
                        fc.isWaitingForApproval = false
                        fc.isWaitingForUserInput = false
                        if (e.result) {
                            fc.result = e.result
                        }
                        if (e.errorContext) {
                            fc.isFailure = true
                            fc.errorContext = e.errorContext
                        }
                        if (e.changed_items) {
                            fc.changed_items = e.changed_items
                        }
                        found = true
                        break
                    }
                }
                if (!found) {
                    // ToolCallComplete arrived without a preceding ToolCall (e.g., from historical events)
                    // Create the function call directly in completed state
                    const turn = getOrCreateTurn("assistant", step_id)
                    turn.function_calls.push({
                        id: step_id,
                        name: e.tool_name,
                        timestamp: event.timestamp ?? eventOrder++,
                        isRunning: false,
                        result: e.result,
                        changed_items: e.changed_items,
                        errorContext: e.errorContext,
                        isFailure: !!e.errorContext,
                        isWaitingForUserInput: false
                    })
                }
                break
            }
            case "ToolApprovalRequest": {
                const e = event as any
                const step_id = e.step_id
                for (const t of turns) {
                    const fc = t.function_calls.find(c => c.id === step_id)
                    if (fc) {
                        fc.isWaitingForApproval = true
                        fc.isRunning = false
                        break
                    }
                }
                break
            }
            case "ToolApprovalResponse": {
                const e = event as ToolApprovalResponse
                const step_id = e.step_id
                for (const t of turns) {
                    const fc = t.function_calls.find(c => c.id === step_id)
                    if (fc) {
                        fc.isWaitingForApproval = false
                        if (e.approved) {
                            fc.isApproved = true
                        } else {
                            fc.isRejected = true
                        }
                    }
                }
                break
            }
            case "RunError": {
                const e = event as RunError
                const lastTurn = turns[turns.length - 1]
                if (lastTurn) {
                    lastTurn.isGenerating = false
                }
                turns.push({
                    role: "assistant",
                    text: e.error,
                    function_calls: [],
                    step_id: "run-error",
                    isFailure: true,
                    isGenerating: false,
                    disableAnimation: true,
                    ...(e.code && { errorCode: e.code })
                })
                break
            }
            case "NaturalStop": {
                const lastTurn = turns[turns.length - 1]
                if (lastTurn) {
                    lastTurn.isGenerating = false
                }
                // Track the step_id as completed if available
                if (lastTurn?.step_id) {
                    completedStepIds.add(lastTurn.step_id)
                }
                break
            }
            case "Thinking": {
                const e = event as { type: "Thinking"; step_id: string }
                const step_id = e.step_id
                const turn = getOrCreateTurn("assistant", step_id)
                turn.isThinking = true
                turn.isGenerating = true
                turn.disableAnimation = true
                break
            }
        }
    })

    // Remove any thinking-only turns that weren't replaced by actual content
    const finalTurns = filterOutThinkingOnlyTurns(turns)

    finalTurns.forEach(turn => {
        const hasWaitingApproval = turn.function_calls.some(fc => fc.isWaitingForApproval)
        if (!hasWaitingApproval) {
            // All historical turns should be marked as not generating
            turn.isGenerating = false
        }
    })
    return finalTurns
}

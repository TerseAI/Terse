import { useState } from "react"

import {
    type Cancelled,
    type ChatSnippet,
    type FilterResult,
    type ModelEvent,
    type ProcessOutput,
    type RunError,
    type TextDelta,
    type Thinking,
    type ToolApprovalRequest,
    type ToolApprovalResponse,
    type ToolCall,
    type ToolCallComplete
} from "terse-types"
import { v4 as uuidv4 } from "uuid"

import { type Turn } from "../Turn"
import { canAppendProcessOutputToTurn, filterOutThinkingOnlyTurns } from "../utils/turnUtils"

interface UseChatTurnsOptions {
    initialTurns?: Turn[] | undefined
}

export function useChatTurns({ initialTurns }: UseChatTurnsOptions = {}) {
    const [turns, setTurns] = useState<Turn[]>(initialTurns || [])

    const handleDelta = ({ delta, response_id, timestamp }: TextDelta) => {
        setTurns(prev => {
            const next = prev.slice()
            const i = next.findIndex(t => t.id === response_id)

            if (i !== -1) {
                const t = next[i]
                next[i] = {
                    ...t,
                    text: t.text + delta,
                    timestamp,
                    isGenerating: true
                }
                return next
            }
            return next.concat({
                role: "assistant",
                id: response_id,
                timestamp,
                text: delta,
                function_calls: [],
                isGenerating: true
            })
        })
    }

    const handleToolCall = ({ summary, id, parameters, timestamp }: ToolCall) => {
        setTurns(prev => {
            const next = prev.slice()
            const i = next.findIndex(t => t.id === id)
            if (i !== -1) {
                const t = next[i]
                const existingCallIndex = t.function_calls.findIndex(call => call.id === id)
                if (existingCallIndex !== -1) {
                    t.function_calls[existingCallIndex] = {
                        ...t.function_calls[existingCallIndex],
                        isGeneratingParams: false,
                        isRunning: true,
                        parameters
                    }
                } else {
                    t.function_calls.push({
                        id,
                        name: summary,
                        timestamp,
                        isGeneratingParams: false,
                        isRunning: true,
                        isWaitingForApproval: false,
                        isWaitingForUserInput: false,
                        parameters
                    })
                }
                t.isGenerating = true
                return next
            } else {
                return [
                    ...next,
                    {
                        role: "assistant",
                        text: "",
                        timestamp,
                        function_calls: [
                            {
                                id,
                                name: summary,
                                timestamp,
                                isGeneratingParams: false,
                                isRunning: true,
                                isWaitingForApproval: false,
                                isWaitingForUserInput: false,
                                parameters
                            }
                        ],
                        isGenerating: true,
                        id
                    }
                ]
            }
        })
    }

    const handleToolApprovalRequest = ({ id }: ToolApprovalRequest) => {
        setTurns(prev => {
            const updated = [...prev]
            // Find the tool call that needs approval
            for (const turn of updated) {
                const toolCall = turn.function_calls.find(call => call.id === id)
                if (toolCall) {
                    toolCall.isRunning = false
                    toolCall.isWaitingForApproval = true
                    break
                }
            }
            return updated
        })
    }

    const handleToolApprovalResponse = ({ id, approved }: ToolApprovalResponse) => {
        if (approved) {
            // Mark as running again and approved
            setTurns(prev => {
                const updated = [...prev]
                for (const turn of updated) {
                    const toolCall = turn.function_calls.find(call => call.id === id)
                    if (toolCall) {
                        toolCall.isRunning = true
                        toolCall.isWaitingForApproval = false
                        toolCall.isApproved = true
                        break
                    }
                }
                return updated
            })
        } else {
            // Mark as failed/rejected
            setTurns(prev => {
                const updated = [...prev]
                for (const turn of updated) {
                    const toolCall = turn.function_calls.find(call => call.id === id)
                    if (toolCall) {
                        toolCall.isRunning = false
                        toolCall.isWaitingForApproval = false
                        toolCall.isRejected = true
                        break
                    }
                }
                return updated
            })
        }
    }

    const handleToolCallComplete = ({ id, result, changed_items, errorContext }: ToolCallComplete & Pick<ModelEvent, "timestamp">) => {
        setTurns(prev => {
            const updated = [...prev]
            let foundExistingCall = false

            // Search through all turns to find the tool call
            for (let i = 0; i < updated.length; i++) {
                const turn = updated[i]
                const toolCallIndex = turn.function_calls.findIndex(call => call.id === id)
                if (toolCallIndex === -1) continue

                const existingCall = turn.function_calls[toolCallIndex]
                const nextCall = {
                    ...existingCall,
                    isRunning: false,
                    isWaitingForApproval: false,
                    isWaitingForUserInput: false,
                    ...(result ? { result } : {}),
                    ...(errorContext ? { isFailure: true, errorContext } : {}),
                    ...(changed_items ? { changed_items } : {})
                }

                const nextCalls = [...turn.function_calls]
                nextCalls[toolCallIndex] = nextCall
                updated[i] = { ...turn, function_calls: nextCalls }
                foundExistingCall = true
                break
            }

            if (foundExistingCall) {
                return updated
            }
            return updated
        })
    }

    const handleRunError = ({ id, error, code, timestamp }: RunError) => {
        setTurns(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last) {
                last.isGenerating = false
            }
            return [
                ...updated,
                {
                    role: "assistant",
                    text: error,
                    timestamp: timestamp,
                    function_calls: [],
                    id: id,
                    isFailure: true,
                    ...(code && { errorCode: code })
                }
            ]
        })
    }

    const handleNaturalStop = () => {
        setTurns(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last) {
                last.isGenerating = false
            }
            return updated
        })
    }

    const handleCancel = (cancellation: Cancelled) => {
        setTurns(prev => {
            const next = prev.slice()
            return next.concat({
                role: "assistant",
                text: cancellation.reason || "",
                timestamp: cancellation.timestamp,
                function_calls: [],
                id: cancellation.id,
                isCancelled: true,
                isGenerating: false,
                isFailure: false,
                isThinking: false
            })
        })
    }

    const handleFilterResult = ({ id, isRelevant, reason, confidence, timestamp }: FilterResult) => {
        setTurns(prev => {
            const next = prev.slice()
            if (next.length > 0) {
                const last = next[next.length - 1]
                last.isGenerating = false
                return next
            }
            return [
                ...next,
                {
                    role: "assistant",
                    text: "",
                    timestamp: timestamp,
                    function_calls: [],
                    id,
                    isGenerating: isRelevant ? true : false,
                    filter_result: {
                        isRelevant,
                        reason,
                        confidence
                    }
                }
            ]
        })
    }

    const handleThinking = (thinking: Thinking) => {
        const { id, timestamp } = thinking
        setTurns(prev => {
            const next = prev.slice()
            const t = next.findIndex(t => t.id === id)
            if (t !== -1) {
                next[t].isThinking = true
                next[t].isGenerating = true
                return next
            }
            // Create new thinking turn
            return [
                ...prev,
                {
                    role: "assistant",
                    text: "",
                    timestamp: timestamp,
                    function_calls: [],
                    id,
                    isThinking: true,
                    isGenerating: true
                }
            ]
        })
    }

    const addUserTurn = (message: string, clientTurnId: string) => {
        const userTurn: Turn = {
            role: "user",
            text: message,
            timestamp: Date.now(),
            function_calls: [],
            id: clientTurnId,
            isGenerating: true
        }
        setTurns(prev => {
            return [...prev, userTurn]
        })
    }

    /**
     * handleSnippet – normalizes snippet UI fields (`id`, `step_id`) and
     * attaches the snippet to a matching turn. Falls back to the last assistant
     * turn, or creates a new one if nothing exists yet.
     */
    const handleSnippet = (snippetPayload: ChatSnippet, snippetTimestamp?: number) => {
        const normalized: ChatSnippet = {
            ...snippetPayload,
            id: snippetPayload.id ?? uuidv4()
        }

        setTurns(prev => {
            const next = prev.slice()

            // Try to find the turn this snippet belongs to via step_id.
            let targetIndex = normalized.id ? next.findIndex(t => t.id === normalized.id) : -1

            // Fallback: attach to the last assistant turn.
            if (targetIndex === -1) {
                for (let i = next.length - 1; i >= 0; i--) {
                    if (next[i].role === "assistant") {
                        targetIndex = i
                        break
                    }
                }
            }

            if (targetIndex !== -1) {
                const turn = next[targetIndex]
                const existingSnippets = turn.snippets ?? []
                const snippetForTurn = normalized.id ? normalized : { ...normalized, id: turn.id }
                next[targetIndex] = {
                    ...turn,
                    snippets: [...existingSnippets, snippetForTurn]
                }
                return next
            }

            // No existing turn — create a minimal assistant turn so the
            // snippet doesn't get lost.
            return [
                ...next,
                {
                    role: "assistant",
                    text: "",
                    timestamp: snippetTimestamp ?? Date.now(),
                    function_calls: [],
                    id: normalized.id || `snippet-${normalized.id}`,
                    snippets: [normalized]
                }
            ]
        })
    }

    const handleProcessOutput = ({ id, stream, content, label, timestamp }: ProcessOutput) => {
        setTurns(prev => {
            const next = prev.slice()
            const lastTurn = next[next.length - 1]
            const lastProcessOutput = lastTurn?.process_outputs?.[lastTurn.process_outputs.length - 1]

            if (canAppendProcessOutputToTurn(lastTurn)) {
                const processOutputs = [...(lastTurn.process_outputs ?? [])]
                const isSameStream = lastProcessOutput && lastProcessOutput.stream === stream && lastProcessOutput.label === label
                if (isSameStream) {
                    processOutputs[processOutputs.length - 1] = {
                        ...lastProcessOutput,
                        content: `${lastProcessOutput.content}${content}`,
                        timestamp
                    }
                } else {
                    processOutputs.push({
                        id,
                        stream,
                        content,
                        label,
                        timestamp
                    })
                }

                next[next.length - 1] = {
                    ...lastTurn,
                    timestamp,
                    process_outputs: processOutputs,
                    isGenerating: false
                }
                return next
            }
            return [
                ...next,
                {
                    role: "assistant",
                    text: "",
                    timestamp,
                    function_calls: [],
                    id,
                    process_outputs: [
                        {
                            id,
                            stream,
                            content,
                            label,
                            timestamp
                        }
                    ],
                    isGenerating: false
                }
            ]
        })
    }

    const handleMultipleChoiceAnswered = (questionId: string, value: string) => {
        setTurns(prev => {
            return prev.map(turn => {
                const snippets = turn.snippets ?? []
                const hasMatch = snippets.some(s => s.type === "multiple_choice" && s.questionId === questionId)
                if (!hasMatch) return turn
                return {
                    ...turn,
                    snippets: snippets.map(s => (s.type === "multiple_choice" && s.questionId === questionId ? { ...s, selectedValue: value } : s))
                }
            })
        })
    }

    const clearTurns = () => {
        setTurns([])
    }

    const filteredTurns = filterOutThinkingOnlyTurns(turns)
    const sortedTurns = [...filteredTurns].sort((a, b) => a.timestamp - b.timestamp)
    const lastTurn = sortedTurns[sortedTurns.length - 1]
    const isPendingAssistantResponse = (sortedTurns.length > 0 && (lastTurn?.role === "user" || lastTurn?.isGenerating)) || false

    return {
        turns: sortedTurns,
        isPendingAssistantResponse,
        handleDelta,
        handleToolCall,
        handleToolApprovalRequest,
        handleToolApprovalResponse,
        handleToolCallComplete,
        handleRunError,
        handleCancel,
        handleNaturalStop,
        handleFilterResult,
        handleThinking,
        addUserTurn,
        handleSnippet,
        handleProcessOutput,
        handleMultipleChoiceAnswered,
        clearTurns
    }
}

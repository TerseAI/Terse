import { useEffect, useState } from "react"

import { v4 as uuidv4 } from "uuid"

import {
    type Cancelled,
    type ChatSnippet,
    type FilterResult,
    type ModelEvent,
    type RenderedChatSnippet,
    type RunError,
    type TextDelta,
    type Thinking,
    type ToolApprovalRequest,
    type ToolApprovalResponse,
    type ToolCall,
    type ToolCallComplete,
    type ToolCallGenerating
} from "../../../shared/ModelEvents"
import { type Turn } from "../Turn"
import { filterOutThinkingOnlyTurns } from "../utils/turnUtils"

interface UseChatTurnsOptions {
    initialTurns?: Turn[] | undefined
}

// Note server turns ALWAYS WIN
function mergeServerTurns(newTurn: Turn, existingTurn: Turn): Turn {
    return newTurn
}

export function useChatTurns({ initialTurns }: UseChatTurnsOptions = {}) {
    const [turns, setTurns] = useState<Turn[]>(initialTurns || [])

    useEffect(() => {
        if (!initialTurns) {
            return
        }
        if (initialTurns && initialTurns.length > 0) {
            setTurns(prev => {
                if (prev.length === 0) {
                    return initialTurns
                }

                // Server turns override local turns with the same step_id.
                // Local turns that have no server counterpart are preserved.
                // Also dedupe local tool-call placeholders when the same call ID
                // is already present in server turns (stream + reload race).
                const serverStepIds = new Set(initialTurns.map(t => t.step_id))
                const serverFunctionCallIds = new Set(initialTurns.flatMap(t => t.function_calls.map(fc => fc.id)))

                const localOnlyTurns = prev
                    .filter(t => !serverStepIds.has(t.step_id))
                    .map(turn => {
                        if (turn.function_calls.length === 0) {
                            return turn
                        }

                        const nextFunctionCalls = turn.function_calls.filter(fc => !serverFunctionCallIds.has(fc.id))
                        if (nextFunctionCalls.length === turn.function_calls.length) {
                            return turn
                        }

                        return {
                            ...turn,
                            function_calls: nextFunctionCalls
                        }
                    })
                    .filter(turn => {
                        if (turn.role === "user") {
                            return true
                        }
                        const hasText = turn.text.trim().length > 0
                        const hasFunctionCalls = turn.function_calls.length > 0
                        const hasSnippets = (turn.snippets?.length ?? 0) > 0
                        return hasText || hasFunctionCalls || hasSnippets
                    })

                return [...initialTurns, ...localOnlyTurns]
            })
        }
    }, [initialTurns])

    const handleDelta = ({ delta, step_id, timestamp }: TextDelta) => {
        setTurns(prev => {
            const next = prev.slice()
            const i = next.findIndex(t => t.step_id === step_id)

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
                step_id,
                timestamp,
                text: delta,
                function_calls: [],
                isGenerating: true
            })
        })
    }

    const handleToolCallGenerating = ({ tool_name, step_id, timestamp }: ToolCallGenerating) => {
        setTurns(prev => {
            const next = prev.slice()
            const i = next.findIndex(t => t.step_id === step_id)
            if (i !== -1) {
                const t = next[i]
                const existingCallIndex = t.function_calls.findIndex(call => call.id === step_id)
                const newCall = {
                    id: step_id,
                    name: tool_name,
                    timestamp: timestamp,
                    isGeneratingParams: true,
                    isRunning: false,
                    isWaitingForApproval: false,
                    isWaitingForUserInput: false
                }
                if (existingCallIndex === -1) {
                    t.function_calls.push(newCall)
                } else {
                    t.function_calls[existingCallIndex] = newCall
                }
                return next
            } else {
                return next.concat({
                    role: "assistant",
                    text: "",
                    timestamp: timestamp,
                    function_calls: [
                        {
                            id: step_id,
                            name: tool_name,
                            timestamp: timestamp,
                            isGeneratingParams: true,
                            isRunning: false,
                            isWaitingForApproval: false,
                            isWaitingForUserInput: false
                        }
                    ],
                    isGenerating: true,
                    step_id
                })
            }
        })
    }

    const handleToolCall = ({ summary, step_id, parameters, timestamp }: ToolCall) => {
        setTurns(prev => {
            const next = prev.slice()
            const i = next.findIndex(t => t.step_id === step_id)
            if (i !== -1) {
                const t = next[i]
                const existingCallIndex = t.function_calls.findIndex(call => call.id === step_id)
                if (existingCallIndex !== -1) {
                    t.function_calls[existingCallIndex] = {
                        ...t.function_calls[existingCallIndex],
                        isGeneratingParams: false,
                        isRunning: true,
                        parameters
                    }
                } else {
                    t.function_calls.push({
                        id: step_id,
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
                                id: step_id,
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
                        step_id
                    }
                ]
            }
        })
    }

    const handleToolApprovalRequest = ({ step_id }: ToolApprovalRequest) => {
        setTurns(prev => {
            const updated = [...prev]
            // Find the tool call that needs approval
            for (const turn of updated) {
                const toolCall = turn.function_calls.find(call => call.id === step_id)
                if (toolCall) {
                    toolCall.isRunning = false
                    toolCall.isWaitingForApproval = true
                    break
                }
            }
            return updated
        })
    }

    const handleToolApprovalResponse = ({ step_id, approved, timestamp }: ToolApprovalResponse) => {
        console.log("Handling tool approval response", { step_id, approved, timestamp })
        if (approved) {
            // Mark as running again and approved
            setTurns(prev => {
                const updated = [...prev]
                for (const turn of updated) {
                    const toolCall = turn.function_calls.find(call => call.id === step_id)
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
                    const toolCall = turn.function_calls.find(call => call.id === step_id)
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

    const handleToolCallComplete = ({ step_id, result, changed_items, errorContext }: ToolCallComplete & Pick<ModelEvent, "timestamp">) => {
        setTurns(prev => {
            const updated = [...prev]
            let foundExistingCall = false

            // Search through all turns to find the tool call
            for (let i = 0; i < updated.length; i++) {
                const turn = updated[i]
                const toolCallIndex = turn.function_calls.findIndex(call => call.id === step_id)
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

    const handleRunError = ({ error, code, timestamp }: RunError) => {
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
                    step_id: "run-error",
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
            if (next.length > 0) {
                const last = next[next.length - 1]
                last.isCancelled = true
                last.isGenerating = false
                return next
            } else {
                return [
                    {
                        role: "assistant",
                        text: cancellation.reason || "",
                        timestamp: cancellation.timestamp,
                        function_calls: [],
                        step_id: "run-error"
                    }
                ]
            }
        })
    }

    const handleFilterResult = ({ isRelevant, reason, confidence, timestamp }: FilterResult) => {
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
                    step_id: "filter",
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
        const { step_id: stepId, timestamp } = thinking
        setTurns(prev => {
            const next = prev.slice()
            const t = next.findIndex(t => t.step_id === stepId)
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
                    step_id: stepId,
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
            step_id: clientTurnId,
            isGenerating: true
        }
        setTurns(prev => {
            return [...prev, userTurn]
        })
    }

    /**
     * handleSnippet – converts a backend ChatSnippet into a RenderedChatSnippet
     * (just adds `id` + ensures `step_id` is set) and attaches it to the
     * matching turn. Falls back to the last assistant turn, or creates a new
     * one if nothing exists yet.
     */
    const handleSnippet = (snippetPayload: ChatSnippet) => {
        console.log("[handleSnippet] received snippet", {
            type: snippetPayload.type,
            step_id: snippetPayload.step_id,
            timestamp: snippetPayload.timestamp,
            payload: snippetPayload
        })

        const rendered: RenderedChatSnippet = {
            ...snippetPayload,
            id: uuidv4(),
            step_id: snippetPayload.step_id ?? ""
        }

        console.log("[handleSnippet] rendered snippet", {
            id: rendered.id,
            type: rendered.type,
            step_id: rendered.step_id
        })

        setTurns(prev => {
            const next = prev.slice()

            // Try to find the turn this snippet belongs to via step_id.
            let targetIndex = rendered.step_id ? next.findIndex(t => t.step_id === rendered.step_id) : -1

            console.log("[handleSnippet] step_id lookup", {
                snippetStepId: rendered.step_id,
                stepIdTruthy: !!rendered.step_id,
                targetIndex,
                turnStepIds: next.map(t => t.step_id)
            })

            // Fallback: attach to the last assistant turn.
            if (targetIndex === -1) {
                for (let i = next.length - 1; i >= 0; i--) {
                    if (next[i].role === "assistant") {
                        targetIndex = i
                        break
                    }
                }
                console.log("[handleSnippet] fallback to last assistant turn", { targetIndex })
            }

            if (targetIndex !== -1) {
                const turn = next[targetIndex]
                const existingSnippets = turn.snippets ?? []
                console.log("[handleSnippet] attaching to turn", {
                    turnStepId: turn.step_id,
                    turnRole: turn.role,
                    turnIsGenerating: turn.isGenerating,
                    existingSnippetCount: existingSnippets.length
                })
                next[targetIndex] = {
                    ...turn,
                    snippets: [...existingSnippets, rendered]
                }
                return next
            }

            console.log("[handleSnippet] no turn found, creating new assistant turn")
            // No existing turn — create a minimal assistant turn so the
            // snippet doesn't get lost.
            return [
                ...next,
                {
                    role: "assistant",
                    text: "",
                    timestamp: rendered.timestamp,
                    function_calls: [],
                    step_id: rendered.step_id || `snippet-${rendered.id}`,
                    snippets: [rendered]
                }
            ]
        })
    }

    const handleMultipleChoiceAnswered = (questionId: string, value: string) => {
        console.log("[handleMultipleChoiceAnswered] called", { questionId, value })

        setTurns(prev => {
            const allSnippets = prev.flatMap(t => t.snippets ?? [])
            console.log(
                "[handleMultipleChoiceAnswered] all snippets across turns",
                allSnippets.map(s => ({
                    id: s.id,
                    type: s.type,
                    step_id: s.step_id,
                    ...(s.type === "multiple_choice" ? { questionId: s.questionId, selectedValue: s.selectedValue } : {})
                }))
            )

            const matchingTurn = prev.find(turn => (turn.snippets ?? []).some(s => s.type === "multiple_choice" && s.questionId === questionId))
            console.log("[handleMultipleChoiceAnswered] matching turn found?", {
                found: !!matchingTurn,
                turnStepId: matchingTurn?.step_id,
                turnIsGenerating: matchingTurn?.isGenerating
            })

            return prev.map(turn => {
                const snippets = turn.snippets ?? []
                const hasMatch = snippets.some(s => s.type === "multiple_choice" && s.questionId === questionId)
                if (!hasMatch) return turn
                const updated = {
                    ...turn,
                    snippets: snippets.map(s => (s.type === "multiple_choice" && s.questionId === questionId ? { ...s, selectedValue: value } : s))
                }
                console.log("[handleMultipleChoiceAnswered] updated turn", {
                    turnStepId: updated.step_id,
                    snippets: updated.snippets?.map(s => ({
                        type: s.type,
                        ...(s.type === "multiple_choice" ? { questionId: s.questionId, selectedValue: s.selectedValue } : {})
                    }))
                })
                return updated
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
    console.log("[useChatTurns] render", {
        turnCount: sortedTurns.length,
        isPendingAssistantResponse,
        lastTurn: lastTurn
            ? {
                  role: lastTurn.role,
                  step_id: lastTurn.step_id,
                  isGenerating: lastTurn.isGenerating,
                  snippetCount: lastTurn.snippets?.length ?? 0,
                  snippetTypes: lastTurn.snippets?.map(s => s.type),
                  fcCount: lastTurn.function_calls.length,
                  fcStates: lastTurn.function_calls.map(fc => ({
                      id: fc.id,
                      isRunning: fc.isRunning,
                      isGeneratingParams: fc.isGeneratingParams
                  }))
              }
            : null
    })

    return {
        turns: sortedTurns,
        isPendingAssistantResponse,
        handleDelta,
        handleToolCallGenerating,
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
        handleMultipleChoiceAnswered,
        clearTurns
    }
}

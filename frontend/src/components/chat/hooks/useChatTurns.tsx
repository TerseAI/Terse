import { useEffect, useRef, useState } from "react"

import { v4 as uuidv4 } from "uuid"

import {
    type ChatSnippet,
    type ChatSnippetPayload,
    FilterResult,
    type ModelEvent,
    type RunError,
    type TextDelta,
    type ToolCall,
    type ToolCallComplete,
    type ToolCallGenerating
} from "../../../shared/ModelEvents"
import { type Turn } from "../Turn"
import { filterOutThinkingOnlyTurns } from "../utils/turnUtils"

/** Find the assistant turn that should receive the snippet (by step_id or last assistant turn). */
function findTurnForSnippet(turns: Turn[], currentStepId: string | null): { turn: Turn; index: number } | null {
    if (currentStepId) {
        const index = turns.findIndex(turn => turn.step_id === currentStepId && turn.role === "assistant")
        if (index !== -1) return { turn: turns[index], index }
    }
    const lastIndex = turns.length - 1
    if (lastIndex >= 0 && turns[lastIndex].role === "assistant") {
        return { turn: turns[lastIndex], index: lastIndex }
    }
    return null
}

/**
 * Merge a new snippet into an existing list. For multiple_choice, replaces any snippet with the same questionId; otherwise appends.
 */
function mergeSnippetIntoList(existingSnippets: ChatSnippet[], newSnippet: ChatSnippet, payload: ChatSnippetPayload): ChatSnippet[] {
    if (payload.type !== "multiple_choice") {
        return [...existingSnippets, newSnippet]
    }
    const existingIndex = existingSnippets.findIndex(s => s.type === "multiple_choice" && s.questionId === payload.questionId)
    if (existingIndex === -1) {
        return [...existingSnippets, newSnippet]
    }
    return existingSnippets.map((s, i) => (i === existingIndex ? newSnippet : s))
}

function mergeFunctionCallsForHydration(initialCalls: Turn["function_calls"], existingCalls: Turn["function_calls"]): Turn["function_calls"] {
    if (initialCalls.length === 0) return existingCalls
    if (existingCalls.length === 0) return initialCalls

    const existingCallsById = new Map(existingCalls.map(call => [call.id, call]))
    const mergedCalls = initialCalls.map(call => {
        const existingCall = existingCallsById.get(call.id)
        // Server data is source-of-truth on re-hydration; keep local-only fields only when missing from server payload.
        return existingCall ? { ...existingCall, ...call } : call
    })

    existingCalls.forEach(call => {
        if (!mergedCalls.some(existing => existing.id === call.id)) {
            mergedCalls.push(call)
        }
    })

    return mergedCalls
}

function mergeSnippetsForHydration(initialSnippets?: ChatSnippet[], existingSnippets?: ChatSnippet[]): ChatSnippet[] | undefined {
    if (!initialSnippets?.length && !existingSnippets?.length) return undefined
    if (!initialSnippets?.length) return existingSnippets
    if (!existingSnippets?.length) return initialSnippets

    const seen = new Set(initialSnippets.map(snippet => snippet.id))
    return [...initialSnippets, ...existingSnippets.filter(snippet => !seen.has(snippet.id))]
}

function mergeAssistantTurnForHydration(initialTurn: Turn, existingTurn: Turn): Turn {
    const initialText = initialTurn.text ?? ""
    const existingText = existingTurn.text ?? ""

    return {
        ...existingTurn,
        ...initialTurn,
        text: existingText.length >= initialText.length ? existingText : initialText,
        function_calls: mergeFunctionCallsForHydration(initialTurn.function_calls, existingTurn.function_calls),
        snippets: mergeSnippetsForHydration(initialTurn.snippets, existingTurn.snippets)
    }
}

interface UseChatTurnsOptions {
    initialTurns?: Turn[] | undefined
}

export function useChatTurns({ initialTurns }: UseChatTurnsOptions = {}) {
    const [turns, setTurns] = useState<Turn[]>(initialTurns || [])
    const stepBuffersRef = useRef<Map<string, string>>(new Map())
    const pendingApprovalsRef = useRef<Set<string>>(new Set())
    const queuedToolCallsRef = useRef<Array<{ summary: string; step_id: string; parameters: string }>>([])
    const currentStepIdRef = useRef<string | null>(null)
    const pendingLocalUserTurnIdsRef = useRef<string[]>([])
    const lastInitialUserTurnCountRef = useRef<number>((initialTurns || []).filter(turn => turn.role === "user").length)

    useEffect(() => {
        if (!initialTurns) {
            return
        }

        const initialUserTurnCount = initialTurns.filter(turn => turn.role === "user").length
        const newlyPersistedLocalUserTurns = Math.max(0, initialUserTurnCount - lastInitialUserTurnCountRef.current)
        if (newlyPersistedLocalUserTurns > 0 && pendingLocalUserTurnIdsRef.current.length > 0) {
            pendingLocalUserTurnIdsRef.current = pendingLocalUserTurnIdsRef.current.slice(newlyPersistedLocalUserTurns)
        }
        lastInitialUserTurnCountRef.current = initialUserTurnCount

        if (initialTurns && initialTurns.length > 0) {
            setTurns(prev => {
                if (prev.length === 0) {
                    return initialTurns
                }

                const previousAssistantTurnsByStepId = new Map(prev.filter(turn => turn.role === "assistant").map(turn => [turn.step_id, turn]))
                const initialAssistantStepIds = new Set(initialTurns.filter(turn => turn.role === "assistant").map(turn => turn.step_id))

                const mergedInitialTurns = initialTurns.map(turn => {
                    if (turn.role !== "assistant") return turn
                    const existingTurn = previousAssistantTurnsByStepId.get(turn.step_id)
                    return existingTurn ? mergeAssistantTurnForHydration(turn, existingTurn) : turn
                })

                const pendingLocalUserTurnIds = new Set(pendingLocalUserTurnIdsRef.current)
                const additionalLocalTurns = prev.filter(turn => {
                    if (turn.role === "assistant") {
                        return !initialAssistantStepIds.has(turn.step_id)
                    }
                    if (turn.role === "user" && turn.localTurnId) {
                        return pendingLocalUserTurnIds.has(turn.localTurnId)
                    }
                    return false
                })

                return additionalLocalTurns.length > 0 ? [...mergedInitialTurns, ...additionalLocalTurns] : mergedInitialTurns
            })
        }
    }, [initialTurns])

    const isPendingAssistantResponse = (turns.length > 0 && (turns[turns.length - 1]?.role === "user" || turns[turns.length - 1]?.isGenerating)) || false

    const handleDelta = ({ delta, step_id }: TextDelta) => {
        // Track current step_id
        currentStepIdRef.current = step_id

        // Merge delta into buffer
        const existing = stepBuffersRef.current.get(step_id) ?? ""
        const newText = existing + delta
        stepBuffersRef.current.set(step_id, newText)

        setTurns(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]

            if (!last || last.step_id !== step_id) {
                return [
                    ...updated,
                    {
                        role: "assistant",
                        text: newText,
                        function_calls: [],
                        isGenerating: true,
                        step_id
                    }
                ]
            }
            last.text = newText
            last.isGenerating = true
            return updated
        })
    }

    const handleToolCallGenerating = ({ tool_name, step_id, timestamp }: ToolCallGenerating & Pick<ModelEvent, "timestamp">) => {
        console.log("[ApprovalFlow] handleToolCallGenerating", { step_id, tool_name })
        // Track current step_id
        currentStepIdRef.current = step_id

        setTurns(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]

            // If last turn is an assistant turn, add generating tool call to it
            if (last && last.role === "assistant") {
                // Check if this tool call already exists
                const existingCallIndex = last.function_calls.findIndex(call => call.id === step_id)

                if (existingCallIndex === -1) {
                    // Add new tool call in generating state
                    last.function_calls.push({
                        id: step_id,
                        name: tool_name,
                        timestamp,
                        isGeneratingParams: true,
                        isRunning: false,
                        isWaitingForApproval: false,
                        isWaitingForUserInput: false
                    })
                }
                last.isGenerating = true
                return updated
            }

            // Otherwise create new assistant turn
            return [
                ...updated,
                {
                    role: "assistant",
                    text: "",
                    function_calls: [
                        {
                            id: step_id,
                            name: tool_name,
                            timestamp,
                            isGeneratingParams: true,
                            isRunning: false,
                            isWaitingForApproval: false,
                            isWaitingForUserInput: false
                        }
                    ],
                    isGenerating: true,
                    step_id
                }
            ]
        })
    }

    const handleToolCall = ({ summary, step_id, parameters, timestamp }: ToolCall & Pick<ModelEvent, "timestamp">) => {
        // Track current step_id
        currentStepIdRef.current = step_id

        setTurns(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]

            // If last turn is an assistant turn, add tool call to it
            if (last && last.role === "assistant") {
                // Check if this tool call already exists (by step_id which is the unique call ID)
                const existingCallIndex = last.function_calls.findIndex(call => call.id === step_id)
                console.log("[ApprovalFlow] handleToolCall", { step_id, name: summary, existingCallFound: existingCallIndex !== -1, turnCount: updated.length })

                if (existingCallIndex !== -1) {
                    // Update existing tool call - transition from generating to running (preserves original timestamp via spread)
                    last.function_calls[existingCallIndex] = {
                        ...last.function_calls[existingCallIndex],
                        isGeneratingParams: false,
                        isRunning: true,
                        parameters
                    }
                } else {
                    // Add new tool call (in case we missed the generating event)
                    last.function_calls.push({
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
                last.isGenerating = true
                return updated
            }

            // Otherwise create new assistant turn
            return [
                ...updated,
                {
                    role: "assistant",
                    text: "",
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
        })
    }

    const handleToolApprovalRequest = ({ step_id }: { step_id: string; name: string; arguments: string }) => {
        // Mark this tool call as waiting for approval
        pendingApprovalsRef.current.add(step_id)

        setTurns(prev => {
            const updated = [...prev]
            // Find the tool call that needs approval
            let foundExistingToolCall = false
            for (const turn of updated) {
                const toolCall = turn.function_calls.find(call => call.id === step_id)
                if (toolCall) {
                    foundExistingToolCall = true
                    toolCall.isRunning = false
                    toolCall.isWaitingForApproval = true
                    break
                }
            }
            console.log("[ApprovalFlow] handleToolApprovalRequest", { step_id, foundExistingToolCall, turnCount: updated.length })
            return updated
        })
    }

    const handleToolApprovalResponse = ({ step_id, approved }: { step_id: string; approved: boolean }) => {
        console.log("[ApprovalFlow] handleToolApprovalResponse", { step_id, approved })
        // Remove from pending approvals
        pendingApprovalsRef.current.delete(step_id)

        if (approved) {
            // Mark as running again and approved
            setTurns(prev => {
                const updated = [...prev]
                let foundExistingToolCall = false
                for (const turn of updated) {
                    const toolCall = turn.function_calls.find(call => call.id === step_id)
                    if (toolCall) {
                        foundExistingToolCall = true
                        toolCall.isRunning = true
                        toolCall.isWaitingForApproval = false
                        toolCall.isApproved = true
                        break
                    }
                }
                console.log("[ApprovalFlow] handleToolApprovalResponse (approved)", { step_id, foundExistingToolCall })
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

        // Process any queued tool calls now that approval is resolved
        if (pendingApprovalsRef.current.size === 0 && queuedToolCallsRef.current.length > 0) {
            const queuedCalls = [...queuedToolCallsRef.current]
            queuedToolCallsRef.current = []

            // Process each queued tool call
            queuedCalls.forEach(call => {
                handleToolCall({ summary: call.summary, step_id: call.step_id, parameters: call.parameters, integration: "unknown" })
            })
        }
    }

    const handleToolCallComplete = ({ step_id, result, changed_items, errorContext }: ToolCallComplete & Pick<ModelEvent, "timestamp">) => {
        console.log("[ApprovalFlow] handleToolCallComplete", { step_id })
        // Track current step_id
        currentStepIdRef.current = step_id

        // Remove from pending approvals if it was there
        pendingApprovalsRef.current.delete(step_id)

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

    const handleRunError = ({ error, code }: RunError) => {
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
            // Clear current step_id when message ends
            currentStepIdRef.current = null
            return updated
        })
    }

    const handleFilterResult = ({ isRelevant, reason, confidence }: FilterResult) => {
        setTurns(prev => {
            const updated = [...prev]
            return [
                ...updated,
                {
                    role: "assistant",
                    text: "",
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

    const handleThinking = (stepId: string) => {
        // Track current step_id
        currentStepIdRef.current = stepId

        setTurns(prev => {
            const last = prev[prev.length - 1]
            if (last && last.step_id === stepId && !last.text && last.function_calls.length === 0) {
                // Update existing turn
                return prev.map(t => (t === last ? { ...t, isThinking: true, isGenerating: true } : t))
            }
            // Create new thinking turn
            return [
                ...prev,
                {
                    role: "assistant",
                    text: "",
                    function_calls: [],
                    step_id: stepId,
                    isThinking: true,
                    isGenerating: true
                }
            ]
        })
    }

    const addUserTurn = (message: string) => {
        const localTurnId = `local-user-${uuidv4()}`
        pendingLocalUserTurnIdsRef.current.push(localTurnId)
        const userTurn: Turn = {
            role: "user",
            text: message,
            function_calls: [],
            step_id: "user_turn",
            localTurnId
        }
        setTurns(prev => {
            return [...prev, userTurn]
        })
    }

    const handleSnippet = (snippetPayload: ChatSnippetPayload) => {
        const snippet: ChatSnippet = {
            ...snippetPayload,
            id: uuidv4()
        }

        setTurns(prev => {
            const updated = [...prev]
            const target = findTurnForSnippet(updated, currentStepIdRef.current)

            if (target) {
                const snippets = mergeSnippetIntoList(target.turn.snippets || [], snippet, snippetPayload)
                const updatedTurn = { ...target.turn, snippets }
                return [...updated.slice(0, target.index), updatedTurn, ...updated.slice(target.index + 1)]
            }

            const stepId = currentStepIdRef.current || `snippet-${snippet.id}`
            return [
                ...updated,
                {
                    role: "assistant",
                    text: "",
                    function_calls: [],
                    step_id: stepId,
                    snippets: [snippet]
                }
            ]
        })
    }

    const handleMultipleChoiceAnswered = (questionId: string, value: string) => {
        setTurns(prev =>
            prev.map(turn => {
                const snippets = turn.snippets ?? []
                const hasMatch = snippets.some(s => s.type === "multiple_choice" && s.questionId === questionId)
                if (!hasMatch) return turn
                return {
                    ...turn,
                    snippets: snippets.map(s => (s.type === "multiple_choice" && s.questionId === questionId ? { ...s, selectedValue: value } : s))
                }
            })
        )
    }

    const clearTurns = () => {
        setTurns([])
        stepBuffersRef.current.clear()
        pendingApprovalsRef.current.clear()
        queuedToolCallsRef.current = []
        pendingLocalUserTurnIdsRef.current = []
        lastInitialUserTurnCountRef.current = 0
    }

    return {
        turns: filterOutThinkingOnlyTurns(turns),
        isPendingAssistantResponse,
        handleDelta,
        handleToolCallGenerating,
        handleToolCall,
        handleToolApprovalRequest,
        handleToolApprovalResponse,
        handleToolCallComplete,
        handleRunError,
        handleNaturalStop,
        handleFilterResult,
        handleThinking,
        addUserTurn,
        handleSnippet,
        handleMultipleChoiceAnswered,
        clearTurns
    }
}

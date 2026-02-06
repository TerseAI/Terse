import { useEffect, useRef, useState } from "react"

import { v4 as uuidv4 } from "uuid"

import { type ChatSnippet, type ChatSnippetPayload, type Failure, FilterResult, type TextDelta, type ToolCall, type ToolCallComplete, type ToolCallGenerating } from "../../../shared/ModelEvents"
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

interface UseChatTurnsOptions {
    initialTurns?: Turn[] | undefined
}

export function useChatTurns({ initialTurns }: UseChatTurnsOptions = {}) {
    const [turns, setTurns] = useState<Turn[]>(initialTurns || [])
    const stepBuffersRef = useRef<Map<string, string>>(new Map())
    const pendingApprovalsRef = useRef<Set<string>>(new Set())
    const queuedToolCallsRef = useRef<Array<{ summary: string; step_id: string; parameters: string }>>([])
    const currentStepIdRef = useRef<string | null>(null)

    useEffect(() => {
        if (initialTurns && initialTurns.length > 0) {
            setTurns(prev => {
                // Create a map of initialTurns by step_id for quick lookup
                const initialTurnsMap = new Map<string, Turn>()
                initialTurns.forEach(turn => {
                    initialTurnsMap.set(turn.step_id, turn)
                })

                // Collect turns from existing that don't exist in initialTurns
                const uniqueExistingTurns = prev.filter(turn => !initialTurnsMap.has(turn.step_id))

                return [...initialTurns, ...uniqueExistingTurns]
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

    const handleToolCallGenerating = ({ tool_name, step_id }: ToolCallGenerating) => {
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

    const handleToolCall = ({ summary, step_id, parameters }: ToolCall) => {
        // Track current step_id
        currentStepIdRef.current = step_id

        setTurns(prev => {
            const updated = [...prev]
            const last = updated[updated.length - 1]

            // If last turn is an assistant turn, add tool call to it
            if (last && last.role === "assistant") {
                // Check if this tool call already exists (by step_id which is the unique call ID)
                const existingCallIndex = last.function_calls.findIndex(call => call.id === step_id)

                if (existingCallIndex !== -1) {
                    // Update existing tool call - transition from generating to running
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

    const handleToolApprovalResponse = ({ step_id, approved }: { step_id: string; approved: boolean }) => {
        // Remove from pending approvals
        pendingApprovalsRef.current.delete(step_id)

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

    const handleToolCallComplete = ({ step_id, result, changed_items, errorContext }: ToolCallComplete) => {
        // Track current step_id
        currentStepIdRef.current = step_id

        // Remove from pending approvals if it was there
        pendingApprovalsRef.current.delete(step_id)

        setTurns(prev => {
            const updated = [...prev]
            // Search through all turns to find the tool call
            for (const turn of updated) {
                const toolCall = turn.function_calls.find(call => call.id === step_id)
                if (toolCall) {
                    toolCall.isRunning = false
                    toolCall.isWaitingForApproval = false
                    toolCall.isWaitingForUserInput = false
                    if (result) {
                        toolCall.result = result
                    }
                    if (errorContext) {
                        toolCall.isFailure = true
                        toolCall.errorContext = errorContext
                    }
                    if (changed_items) {
                        toolCall.changed_items = changed_items
                    }
                    break
                }
            }
            return updated
        })
    }

    const handleFailure = ({ error }: Failure) => {
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
                    text: `Something went wrong. Please try again. ${error}`,
                    function_calls: [],
                    step_id: "",
                    isFailure: true
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
        const userTurn: Turn = {
            role: "user",
            text: message,
            function_calls: [],
            step_id: "user_turn"
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
        handleFailure,
        handleNaturalStop,
        handleFilterResult,
        handleThinking,
        addUserTurn,
        handleSnippet,
        handleMultipleChoiceAnswered,
        clearTurns
    }
}

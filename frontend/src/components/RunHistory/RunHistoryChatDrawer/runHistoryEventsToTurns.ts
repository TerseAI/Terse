import { Turn } from "@/components/chat/Turn"
import { filterOutThinkingOnlyTurns } from "@/components/chat/utils/turnUtils"
import type { Cancelled, ChatSnippet, Thinking } from "@/shared/ModelEvents"
import { FilterResult, ModelEvent, RunError, TextDelta, ToolApprovalRequest, ToolApprovalResponse, ToolCall, ToolCallComplete, UserMessage } from "@/shared/ModelEvents"

type FunctionCallEvent = Turn["function_calls"][number]

function mergeSnippetIntoList(existingSnippets: ChatSnippet[], newSnippet: ChatSnippet): ChatSnippet[] {
    if (newSnippet.type !== "multiple_choice") {
        return [...existingSnippets, newSnippet]
    }
    const existingIndex = existingSnippets.findIndex(s => s.type === "multiple_choice" && s.questionId === newSnippet.questionId)
    if (existingIndex === -1) {
        return [...existingSnippets, newSnippet]
    }
    return existingSnippets.map((s, i) => (i === existingIndex ? newSnippet : s))
}

function findFunctionCall(turns: Turn[], stepId: string): FunctionCallEvent | null {
    for (const t of turns) {
        const fc = t.function_calls.find(c => c.id === stepId)
        if (fc) return fc
    }
    return null
}

function updateOrCreateFunctionCall(
    turns: Turn[],
    getOrCreateTurn: (role: "assistant" | "user", step_id: string, timestamp: number) => Turn,
    stepId: string,
    timestamp: number,
    update: (fc: FunctionCallEvent) => void,
    create: () => FunctionCallEvent
): void {
    const fc = findFunctionCall(turns, stepId)
    if (fc) {
        update(fc)
    } else {
        const turn = getOrCreateTurn("assistant", stepId, timestamp)
        turn.function_calls.push(create())
    }
}

function findSnippetTargetTurnIndex(turns: Turn[], stepId?: string): number {
    if (!stepId) {
        return -1
    }
    for (let i = turns.length - 1; i >= 0; i--) {
        const turn = turns[i]
        if (turn.role !== "assistant") {
            continue
        }
        if (turn.step_id === stepId) {
            return i
        }
        if (turn.function_calls.some(fc => fc.id === stepId)) {
            return i
        }
    }
    return -1
}

function findLastAssistantTurnIndex(turns: Turn[]): number {
    for (let i = turns.length - 1; i >= 0; i--) {
        if (turns[i].role === "assistant") {
            return i
        }
    }
    return -1
}

function normalizeSnippet(payload: ChatSnippet, fallbackStepId: string, fallbackId: string): ChatSnippet {
    return {
        ...payload,
        id: payload.id ?? fallbackId,
        step_id: payload.step_id ?? fallbackStepId
    }
}

export function convertRunHistoryEventsToTurns(events: ModelEvent[]): Turn[] {
    const turns: Turn[] = []
    const stepBuffers = new Map<string, string>()
    let eventOrder = 0

    const getOrCreateTurn = (role: "assistant" | "user", step_id: string, timestamp: number): Turn => {
        const lastTurn = turns[turns.length - 1]
        if (lastTurn && lastTurn.role === role && (role === "user" || lastTurn.step_id === step_id)) {
            return lastTurn
        }
        const newTurn: Turn = {
            role,
            text: "",
            timestamp,
            function_calls: [],
            step_id,
            isGenerating: role === "assistant"
        }
        turns.push(newTurn)
        return newTurn
    }

    const stopLastTurn = () => {
        const last = turns[turns.length - 1]
        if (last) last.isGenerating = false
    }

    const baseFc = (stepId: string, timestamp?: number) => ({
        id: stepId,
        timestamp,
        isRunning: false,
        isWaitingForUserInput: false as const
    })

    for (const event of events) {
        switch (event.type) {
            case "UserMessage": {
                const e = event as UserMessage
                turns.push({
                    role: "user",
                    text: e.message,
                    timestamp: event.timestamp,
                    function_calls: [],
                    step_id: e.step_id,
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
                    timestamp: e.timestamp,
                    function_calls: [],
                    step_id: "filter",
                    isGenerating: true,
                    filter_result: { isRelevant: e.isRelevant, reason: e.reason, confidence: e.confidence },
                    disableAnimation: true
                })
                break
            }
            case "TextDelta": {
                const e = event as TextDelta
                const text = (stepBuffers.get(e.step_id) ?? "") + e.delta
                stepBuffers.set(e.step_id, text)
                const turn = getOrCreateTurn("assistant", e.step_id, e.timestamp)
                turn.text = text
                turn.isThinking = false
                turn.isGenerating = true
                turn.disableAnimation = true
                break
            }
            case "ToolCall": {
                const e = event as ToolCall
                const lastTurn = turns[turns.length - 1]
                const turn = lastTurn && lastTurn.role === "assistant" ? lastTurn : getOrCreateTurn("assistant", e.step_id, e.timestamp)
                turn.disableAnimation = true
                const existing = turn.function_calls.find(c => c.id === e.step_id)
                if (!existing) {
                    turn.function_calls.push({
                        ...baseFc(e.step_id, e.timestamp),
                        name: e.summary,
                        parameters: e.parameters
                    })
                } else {
                    existing.parameters = e.parameters
                    existing.name = e.summary
                }
                turn.isGenerating = true
                break
            }
            case "ToolCallComplete": {
                const e = event as ToolCallComplete
                updateOrCreateFunctionCall(
                    turns,
                    getOrCreateTurn,
                    e.step_id,
                    e.timestamp,
                    fc => {
                        fc.isRunning = false
                        fc.isWaitingForApproval = false
                        fc.isWaitingForUserInput = false
                        if (e.result) fc.result = e.result
                        if (e.errorContext) {
                            fc.isFailure = true
                            fc.errorContext = e.errorContext
                        }
                        if (e.changed_items) fc.changed_items = e.changed_items
                    },
                    () => ({
                        ...baseFc(e.step_id, e.timestamp),
                        name: e.tool_name,
                        result: e.result,
                        changed_items: e.changed_items,
                        errorContext: e.errorContext,
                        isFailure: !!e.errorContext
                    })
                )
                break
            }
            case "ToolApprovalRequest": {
                const e = event as ToolApprovalRequest
                updateOrCreateFunctionCall(
                    turns,
                    getOrCreateTurn,
                    e.step_id,
                    e.timestamp,
                    fc => {
                        fc.isWaitingForApproval = true
                        fc.isRunning = false
                    },
                    () => ({
                        ...baseFc(e.step_id, e.timestamp),
                        name: e.name,
                        parameters: e.arguments,
                        isWaitingForApproval: true
                    })
                )
                break
            }
            case "ToolApprovalResponse": {
                const e = event as ToolApprovalResponse
                updateOrCreateFunctionCall(
                    turns,
                    getOrCreateTurn,
                    e.step_id,
                    e.timestamp,
                    fc => {
                        fc.isWaitingForApproval = false
                        fc.isRunning = false
                        fc.isApproved = e.approved
                        fc.isRejected = !e.approved
                    },
                    () => ({
                        ...baseFc(e.step_id, e.timestamp),
                        name: e.step_id,
                        isApproved: e.approved,
                        isRejected: !e.approved,
                        isWaitingForApproval: false
                    })
                )
                break
            }
            case "RunError": {
                const e = event as RunError
                stopLastTurn()
                turns.push({
                    role: "assistant",
                    text: e.error,
                    timestamp: event.timestamp,
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
                stopLastTurn()
                break
            }
            case "Cancelled": {
                const e = event as Cancelled
                stopLastTurn()
                turns.push({
                    role: "assistant",
                    timestamp: event.timestamp,
                    text: e.reason ? `Run cancelled: ${e.reason}` : "Run cancelled by user",
                    function_calls: [],
                    step_id: "cancel",
                    isFailure: false,
                    isGenerating: false,
                    isCancelled: true,
                    disableAnimation: true
                })
                break
            }
            case "Thinking": {
                const e = event as Thinking
                const turn = getOrCreateTurn("assistant", e.step_id, event.timestamp)
                turn.isThinking = true
                turn.isGenerating = true
                turn.disableAnimation = true
                break
            }
            case "Snippet": {
                const payload = event.snippet
                const fallbackStepId = payload.step_id ?? `snippet-${eventOrder}`
                const snippet = normalizeSnippet(payload, fallbackStepId, `snippet-${eventOrder++}`)
                const targetTurnIndex = findSnippetTargetTurnIndex(turns, snippet.step_id)

                if (targetTurnIndex !== -1) {
                    const targetTurn = turns[targetTurnIndex]
                    targetTurn.snippets = mergeSnippetIntoList(targetTurn.snippets ?? [], snippet)
                    break
                }

                const lastAssistantTurnIndex = findLastAssistantTurnIndex(turns)
                if (lastAssistantTurnIndex !== -1) {
                    const targetTurn = turns[lastAssistantTurnIndex]
                    targetTurn.snippets = mergeSnippetIntoList(targetTurn.snippets ?? [], snippet)
                    break
                }

                const turn = getOrCreateTurn("assistant", snippet.step_id ?? `snippet-${eventOrder}`, event.timestamp)
                turn.snippets = [snippet]
                break
            }
        }
    }

    const finalTurns = filterOutThinkingOnlyTurns(turns)

    for (const turn of finalTurns) {
        const hasWaitingApproval = turn.function_calls.some(fc => fc.isWaitingForApproval)
        if (!hasWaitingApproval) {
            turn.isGenerating = false
        }
    }

    return finalTurns
}

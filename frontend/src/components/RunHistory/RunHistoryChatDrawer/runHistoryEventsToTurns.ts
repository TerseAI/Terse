import { v4 as uuidv4 } from "uuid"

import { Turn } from "@/components/chat/Turn"
import { filterOutThinkingOnlyTurns } from "@/components/chat/utils/turnUtils"
import type { ChatSnippet, ChatSnippetPayload } from "@/shared/ModelEvents"
import { FilterResult, ModelEvent, RunError, TextDelta, ToolApprovalRequest, ToolApprovalResponse, ToolCall, ToolCallComplete, UserMessage } from "@/shared/ModelEvents"

type FunctionCallEvent = Turn["function_calls"][number]

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

function findFunctionCall(turns: Turn[], stepId: string): FunctionCallEvent | null {
    for (const t of turns) {
        const fc = t.function_calls.find(c => c.id === stepId)
        if (fc) return fc
    }
    return null
}

function updateOrCreateFunctionCall(
    turns: Turn[],
    getOrCreateTurn: (role: "assistant" | "user", step_id: string) => Turn,
    stepId: string,
    update: (fc: FunctionCallEvent) => void,
    create: () => FunctionCallEvent
): void {
    const fc = findFunctionCall(turns, stepId)
    if (fc) {
        update(fc)
    } else {
        const turn = getOrCreateTurn("assistant", stepId)
        turn.function_calls.push(create())
    }
}

export function convertRunHistoryEventsToTurns(events: (ModelEvent & { timestamp?: number })[]): Turn[] {
    const turns: Turn[] = []
    const stepBuffers = new Map<string, string>()
    let eventOrder = 0

    const getOrCreateTurn = (role: "assistant" | "user", step_id: string): Turn => {
        const lastTurn = turns[turns.length - 1]
        if (lastTurn && lastTurn.role === role && (role === "user" || lastTurn.step_id === step_id)) {
            return lastTurn
        }
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
                    filter_result: { isRelevant: e.isRelevant, reason: e.reason, confidence: e.confidence },
                    disableAnimation: true
                })
                break
            }
            case "TextDelta": {
                const e = event as TextDelta
                const text = (stepBuffers.get(e.step_id) ?? "") + e.delta
                stepBuffers.set(e.step_id, text)
                const turn = getOrCreateTurn("assistant", e.step_id)
                turn.text = text
                turn.isThinking = false
                turn.isGenerating = true
                turn.disableAnimation = true
                break
            }
            case "ToolCall": {
                const e = event as ToolCall
                const lastTurn = turns[turns.length - 1]
                const turn = lastTurn && lastTurn.role === "assistant" ? lastTurn : getOrCreateTurn("assistant", e.step_id)
                turn.disableAnimation = true
                const existing = turn.function_calls.find(c => c.id === e.step_id)
                if (!existing) {
                    turn.function_calls.push({
                        ...baseFc(e.step_id, event.timestamp),
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
                    fc => {
                        fc.isRunning = false
                        fc.isWaitingForApproval = false
                        fc.isWaitingForUserInput = false
                        fc.name = e.tool_name
                        if (e.result) fc.result = e.result
                        if (e.errorContext) {
                            fc.isFailure = true
                            fc.errorContext = e.errorContext
                        }
                        if (e.changed_items) fc.changed_items = e.changed_items
                    },
                    () => ({
                        ...baseFc(e.step_id, event.timestamp ?? eventOrder++),
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
                    fc => {
                        fc.isWaitingForApproval = true
                        fc.isRunning = false
                    },
                    () => ({
                        ...baseFc(e.step_id, event.timestamp),
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
                    fc => {
                        fc.isWaitingForApproval = false
                        fc.isRunning = false
                        fc.isApproved = e.approved
                        fc.isRejected = !e.approved
                    },
                    () => ({
                        ...baseFc(e.step_id, event.timestamp),
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
            case "Thinking": {
                const e = event as { type: "Thinking"; step_id: string }
                const turn = getOrCreateTurn("assistant", e.step_id)
                turn.isThinking = true
                turn.isGenerating = true
                turn.disableAnimation = true
                break
            }
            case "Snippet": {
                const e = event as { type: "Snippet"; snippet: ChatSnippetPayload }
                const snippet: ChatSnippet = { ...e.snippet, id: uuidv4() } as ChatSnippet
                const lastTurn = turns[turns.length - 1]
                if (lastTurn && lastTurn.role === "assistant") {
                    const snippets = mergeSnippetIntoList(lastTurn.snippets ?? [], snippet, e.snippet)
                    lastTurn.snippets = snippets
                } else {
                    const turn = getOrCreateTurn("assistant", `snippet-${snippet.id}`)
                    turn.snippets = [snippet]
                }
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

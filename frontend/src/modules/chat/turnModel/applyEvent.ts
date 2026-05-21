import type { ChatSnippet, ModelEvent, ToolCallExecutionStatus } from "terse-types"
import { v4 as uuidv4 } from "uuid"

import type { ProcessOutputUnit, SnippetUnit, ThinkingUnit, ToolCallUnit, Turn, TurnUnit } from "./types"

function cloneTurns(turns: Turn[]): Turn[] {
    return turns.map(turn => ({
        ...turn,
        units: turn.units.map(unit => {
            if (unit.kind === "process_output") return { ...unit, chunks: unit.chunks.map(chunk => ({ ...chunk })) }
            if (unit.kind === "snippet") return { ...unit, snippet: { ...unit.snippet } }
            if (unit.kind === "tool_call") return { ...unit, changedItems: unit.changedItems?.map(item => ({ ...item })), approval: unit.approval ? { ...unit.approval } : undefined }
            return { ...unit }
        })
    }))
}

function createAssistantTurn(id: string, timestamp: number, disableAnimation?: boolean): Turn {
    return {
        id,
        role: "assistant",
        timestamp,
        units: [],
        status: "generating",
        disableAnimation
    }
}

function getOrCreateAssistantTurn(turns: Turn[], responseId: string, timestamp: number, disableAnimation?: boolean): Turn {
    const existing = turns.find(turn => turn.role === "assistant" && turn.id === responseId)
    if (existing) return existing

    const turn = createAssistantTurn(responseId, timestamp, disableAnimation)
    turns.push(turn)
    return turn
}

function findLastAssistantTurn(turns: Turn[]): Turn | undefined {
    for (let i = turns.length - 1; i >= 0; i--) {
        if (turns[i].role === "assistant") return turns[i]
    }
    return undefined
}

function findTurnWithToolCall(turns: Turn[], unitId: string): Turn | undefined {
    return turns.find(turn => turn.role === "assistant" && turn.units.some(unit => unit.kind === "tool_call" && unit.unitId === unitId))
}

function getOrCreateUnit<T extends TurnUnit>(turn: Turn, unitId: string, create: () => T): T {
    const existing = turn.units.find(unit => unit.unitId === unitId)
    if (existing) return existing as T

    const unit = create()
    turn.units.push(unit)
    return unit
}

function hasVisibleUnit(turn: Turn): boolean {
    return turn.units.some(unit => unit.kind !== "thinking")
}

function markThinkingInactive(turn: Turn): void {
    turn.units = turn.units.map(unit => (unit.kind === "thinking" ? { ...unit, active: false } : unit))
}

function stopPreviousGeneratingAssistant(turns: Turn[]): void {
    const lastAssistant = findLastAssistantTurn(turns)
    if (!lastAssistant || lastAssistant.status !== "generating") return
    lastAssistant.status = hasVisibleUnit(lastAssistant) ? "natural_stop" : "natural_stop"
    markThinkingInactive(lastAssistant)
}

function mergeSnippet(existing: ChatSnippet, next: ChatSnippet): ChatSnippet {
    return {
        ...next,
        selectedValue: next.selectedValue ?? existing.selectedValue
    }
}

function getSnippetUnitId(event: Extract<ModelEvent, { type: "Snippet" }>): string {
    if (event.snippet.type === "multiple_choice") {
        return `multiple-choice-${event.snippet.questionId}`
    }
    return event.snippet.id ?? event.id
}

function isFailedToolStatus(status: ToolCallExecutionStatus): boolean {
    return status === "failed"
}

export function applyEvent(turns: Turn[], event: ModelEvent, options: { disableAnimation?: boolean } = {}): Turn[] {
    const next = cloneTurns(turns)
    const disableAnimation = options.disableAnimation

    switch (event.type) {
        case "UserMessage":
            return [
                ...next,
                {
                    id: event.client_turn_id,
                    role: "user",
                    timestamp: event.timestamp,
                    units: [],
                    status: "natural_stop",
                    userMessage: event.message,
                    disableAnimation
                }
            ]

        case "TextDelta": {
            const turn = getOrCreateAssistantTurn(next, event.response_id, event.timestamp, disableAnimation)
            const unit = getOrCreateUnit(turn, event.id, () => ({
                kind: "text",
                unitId: event.id,
                timestamp: event.timestamp,
                text: ""
            }))
            unit.text += event.delta
            turn.status = "generating"
            return next
        }

        case "ToolCall": {
            const turn = getOrCreateAssistantTurn(next, event.response_id, event.timestamp, disableAnimation)
            const unit = getOrCreateUnit<ToolCallUnit>(turn, event.id, () => ({
                kind: "tool_call",
                unitId: event.id,
                timestamp: event.timestamp,
                name: event.summary,
                status: event.parameters ? "running" : "generating_params"
            }))
            unit.name = event.summary
            unit.integration = event.integration
            unit.parameters = event.parameters
            unit.responseId = event.response_id
            unit.status = event.parameters ? "running" : "generating_params"
            turn.status = "generating"
            return next
        }

        case "ToolApprovalRequest": {
            const turn = findTurnWithToolCall(next, event.id) ?? getOrCreateAssistantTurn(next, event.response_id, event.timestamp, disableAnimation)
            const unit = getOrCreateUnit<ToolCallUnit>(turn, event.id, () => ({
                kind: "tool_call",
                unitId: event.id,
                timestamp: event.timestamp,
                name: event.name,
                parameters: event.arguments,
                status: "waiting_approval"
            }))
            unit.name = event.name
            unit.parameters = event.arguments
            unit.responseId = event.response_id
            unit.status = "waiting_approval"
            turn.status = "generating"
            return next
        }

        case "ToolApprovalResponse": {
            const turn = findTurnWithToolCall(next, event.id) ?? getOrCreateAssistantTurn(next, event.response_id, event.timestamp, disableAnimation)
            const unit = getOrCreateUnit<ToolCallUnit>(turn, event.id, () => ({
                kind: "tool_call",
                unitId: event.id,
                timestamp: event.timestamp,
                name: event.id,
                status: event.approved ? "approved_running" : "rejected"
            }))
            unit.status = event.approved ? "approved_running" : "rejected"
            unit.approval = { approved: event.approved, rejectionReason: event.rejection_reason }
            turn.status = "generating"
            return next
        }

        case "ToolCallComplete": {
            const turn = findTurnWithToolCall(next, event.id) ?? getOrCreateAssistantTurn(next, event.response_id, event.timestamp, disableAnimation)
            const unit = getOrCreateUnit<ToolCallUnit>(turn, event.id, () => ({
                kind: "tool_call",
                unitId: event.id,
                timestamp: event.timestamp,
                name: event.tool_name,
                status: "completed"
            }))
            unit.name = event.tool_name
            unit.integration = event.integration
            unit.result = event.result
            unit.changedItems = event.changed_items
            unit.errorContext = event.errorContext
            unit.status = event.errorContext || isFailedToolStatus(event.status) ? "failed" : "completed"
            return next
        }

        case "Snippet": {
            const unitId = getSnippetUnitId(event)
            const turn =
                event.response_id && next.some(candidate => candidate.role === "assistant" && candidate.id === event.response_id)
                    ? getOrCreateAssistantTurn(next, event.response_id, event.timestamp, disableAnimation)
                    : (findLastAssistantTurn(next) ?? getOrCreateAssistantTurn(next, event.response_id || `snippet-fallback-${event.id}`, event.timestamp, disableAnimation))
            const unit = getOrCreateUnit<SnippetUnit>(turn, unitId, () => ({
                kind: "snippet",
                unitId,
                timestamp: event.timestamp,
                snippet: {
                    ...event.snippet,
                    id: event.snippet.id ?? unitId
                }
            }))
            unit.snippet = mergeSnippet(unit.snippet, { ...event.snippet, id: event.snippet.id ?? unitId })
            return next
        }

        case "ProcessOutput": {
            const existingTailTurn = findLastAssistantTurn(next)
            const tailUnit = existingTailTurn?.units[existingTailTurn.units.length - 1]
            const shouldAppendToTail = !!existingTailTurn && tailUnit?.kind === "process_output" && tailUnit.label === event.label && existingTailTurn.id !== event.response_id
            const turn = shouldAppendToTail ? existingTailTurn : getOrCreateAssistantTurn(next, event.response_id, event.timestamp, disableAnimation)
            const unit = getOrCreateUnit<ProcessOutputUnit>(turn, event.label, () => ({
                kind: "process_output",
                unitId: event.label,
                timestamp: event.timestamp,
                label: event.label,
                chunks: []
            }))
            const lastChunk = unit.chunks[unit.chunks.length - 1]
            if (lastChunk?.stream === event.stream) {
                unit.chunks[unit.chunks.length - 1] = {
                    ...lastChunk,
                    content: `${lastChunk.content}${event.content}`,
                    timestamp: event.timestamp
                }
            } else {
                unit.chunks.push({
                    stream: event.stream,
                    content: event.content,
                    timestamp: event.timestamp
                })
            }
            return next
        }

        case "Thinking": {
            const turn = getOrCreateAssistantTurn(next, event.response_id, event.timestamp, disableAnimation)
            getOrCreateUnit<ThinkingUnit>(turn, event.id, () => ({
                kind: "thinking",
                unitId: event.id,
                timestamp: event.timestamp,
                active: true
            })).active = true
            turn.status = "generating"
            return next
        }

        case "NaturalStop": {
            const turn = next.find(candidate => candidate.role === "assistant" && candidate.id === event.response_id) ?? findLastAssistantTurn(next)
            if (turn) {
                turn.status = "natural_stop"
                markThinkingInactive(turn)
            }
            return next
        }

        case "Cancelled":
            stopPreviousGeneratingAssistant(next)
            return [
                ...next,
                {
                    id: event.id,
                    role: "assistant",
                    timestamp: event.timestamp,
                    units: [],
                    status: "cancelled",
                    cancelReason: event.reason,
                    disableAnimation
                }
            ]

        case "RunError":
            stopPreviousGeneratingAssistant(next)
            return [
                ...next,
                {
                    id: event.id,
                    role: "assistant",
                    timestamp: event.timestamp,
                    units: [],
                    status: "failed",
                    error: { message: event.error, code: event.code },
                    disableAnimation
                }
            ]

        default: {
            const exhaustive: never = event
            return exhaustive
        }
    }
}

export function applyEvents(events: ModelEvent[], options: { disableAnimation?: boolean } = {}): Turn[] {
    return events.reduce<Turn[]>((turns, event) => applyEvent(turns, event, options), [])
}

export function makeLocalUserMessageEvent(message: string, clientTurnId: string): ModelEvent {
    return {
        type: "UserMessage",
        id: clientTurnId,
        response_id: clientTurnId,
        timestamp: Date.now(),
        message,
        client_turn_id: clientTurnId || uuidv4()
    }
}

import type { ChangedItem, ChatSnippet, SharedErrorContext } from "terse-types"

interface BaseUnit {
    unitId: string
    timestamp: number
}

export interface TextUnit extends BaseUnit {
    kind: "text"
    text: string
}

type ToolCallStatus = "generating_params" | "running" | "waiting_approval" | "approved_running" | "rejected" | "completed" | "failed"

export interface ToolCallUnit extends BaseUnit {
    kind: "tool_call"
    name: string
    integration?: string
    parameters?: string
    result?: string
    changedItems?: ChangedItem[]
    errorContext?: SharedErrorContext
    status: ToolCallStatus
    approval?: { approved: boolean; rejectionReason?: string }
    responseId?: string
}

export interface SnippetUnit extends BaseUnit {
    kind: "snippet"
    snippet: ChatSnippet
}

interface ProcessOutputChunk {
    stream: "stdout" | "stderr"
    content: string
    timestamp: number
}

export interface ProcessOutputUnit extends BaseUnit {
    kind: "process_output"
    label: string
    chunks: ProcessOutputChunk[]
}

export interface ThinkingUnit extends BaseUnit {
    kind: "thinking"
    active: boolean
}

export type TurnUnit = TextUnit | ToolCallUnit | SnippetUnit | ProcessOutputUnit | ThinkingUnit

type TurnStatus = "generating" | "natural_stop" | "cancelled" | "failed"

export interface Turn {
    id: string
    role: "user" | "assistant"
    timestamp: number
    units: TurnUnit[]
    status: TurnStatus
    userMessage?: string
    error?: { message: string; code?: string }
    cancelReason?: string
    disableAnimation?: boolean
}

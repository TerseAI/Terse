import { EntityType } from "./Entities"
import type { MultipleChoiceOption } from "./Survey"

export enum ChangeEventType {
    CREATED = "CREATED",
    UPDATED = "UPDATED",
    ACTION_EXECUTED = "ACTION_EXECUTED"
}

export type SharedErrorContext = {
    error: Error | unknown
}

export type ChangedItem = { type_name: EntityType; id: string; change_event_type: ChangeEventType }

/** Run-level / agent-level error (e.g. context window exceeded). Use optional code for specific UI handling. */
export type RunError = { error: string; code?: string; timestamp: number }
export type Cancelled = { reason?: string; timestamp: number }

export type FunctionCall = { function_name: string; result: string; step_id: string }

export type ModelEvent = (
    | ({ type: "ToolApprovalResponse" } & ToolApprovalResponse)
    | ({ type: "ToolApprovalRequest" } & ToolApprovalRequest)
    | ({ type: "ToolCallGenerating" } & ToolCallGenerating)
    | ({ type: "ToolCall" } & ToolCall)
    | ({ type: "ToolCallComplete" } & ToolCallComplete)
    | ({ type: "TextDelta" } & TextDelta)
    | ({ type: "RunError" } & RunError)
    | ({ type: "Cancelled" } & Cancelled)
    | ({ type: "NaturalStop" } & NaturalStop)
    | ({ type: "FilterResult" } & FilterResult)
    | ({ type: "UserMessage" } & UserMessage)
    | ({ type: "Thinking" } & Thinking)
    | ({ type: "Snippet" } & { snippet: ChatSnippet })
) & { timestamp: number }

export type NaturalStop = { step_id: string; timestamp: number }

export type ModelRequest = ({ type: "SendModelRequest" } & SendModelRequest) | ({ type: "ToolApprovalResponse" } & ToolApprovalResponse)

export type SendModelRequest = { user_message: string; timezone: string; ui_state?: string; client_turn_id: string, template_id?: string }

export type ToolApprovalResponse = { step_id: string; approved: boolean; timestamp: number }

export type ToolApprovalRequest = { step_id: string; name: string; arguments: string; timestamp: number }

export type TextDelta = { delta: string; step_id: string; timestamp: number }

export type ToolCallGenerating = { tool_name: string; step_id: string; timestamp: number }

export type ToolCall = { summary: string; step_id: string; parameters: string; integration: string; timestamp: number }

export type Thinking = { step_id: string; timestamp: number }

export enum ToolCallExecutionStatus {
    COMPLETED = "completed",
    INCOMPLETE = "incomplete",
    FAILED = "failed",
    UNKNOWN = "unknown"
}

export type ToolCallComplete = {
    tool_name: string
    timestamp: number
    status: ToolCallExecutionStatus
    step_id: string
    changed_items: ChangedItem[]
    integration: string
    url?: string
    result?: string
    errorContext?: SharedErrorContext
}

export type FilterResult = { isRelevant: boolean; reason: string; confidence: number; step_id: string; timestamp: number }

export type UserMessage = { message: string; step_id: string; client_turn_id: string; timestamp: number; }

// Shared variant union – the payload shapes used by every snippet type.
export type SnippetVariant =
    | { type: "button"; label: string; url: string }
    | { type: "integration_prompt"; integration: string; message: string; stateToken?: string }
    | { type: "navigate"; path: string }
    | { type: "multiple_choice"; questionId: string; question: string; options: MultipleChoiceOption[]; allowMultiple?: boolean }
    | { type: "image"; url: string }

// Canonical snippet payload used across backend and frontend.
// `id` and `selectedValue` are optional UI fields added by the web client.
export type ChatSnippet = { id?: string; step_id?: string; selectedValue?: string } & SnippetVariant

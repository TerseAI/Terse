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

export type Failure = { error: string; step_id: string }

/** Run-level / agent-level error (e.g. context window exceeded). Use optional code for specific UI handling. */
export type RunError = { error: string; code?: string }

export type FunctionCall = { function_name: string; result: string; step_id: string }

export type ModelEvent =
    | ({ type: "ToolApprovalResponse" } & ToolApprovalResponse)
    | ({ type: "ToolApprovalRequest" } & ToolApprovalRequest)
    | ({ type: "ToolCallGenerating" } & ToolCallGenerating)
    | ({ type: "ToolCall" } & ToolCall)
    | ({ type: "ToolCallComplete" } & ToolCallComplete)
    | ({ type: "TextDelta" } & TextDelta)
    | ({ type: "Failure" } & Failure)
    | ({ type: "RunError" } & RunError)
    | { type: "NaturalStop"; step_id: string }
    | ({ type: "FilterResult" } & FilterResult)
    | ({ type: "UserMessage" } & UserMessage)
    | { type: "Thinking"; step_id: string }
    | ({ type: "Snippet" } & { snippet: ChatSnippetPayload })

export type ModelRequest = ({ type: "SendModelRequest" } & SendModelRequest) | ({ type: "ToolApprovalResponse" } & ToolApprovalResponse)

export type SendModelRequest = { user_message: string; timezone: string; ui_state?: string }

export type ToolApprovalResponse = { step_id: string; approved: boolean }

export type ToolApprovalRequest = { step_id: string; name: string; arguments: string }

export type TextDelta = { delta: string; step_id: string }

export type ToolCallGenerating = { tool_name: string; step_id: string }

export type ToolCall = { summary: string; step_id: string; parameters: string; integration: string }

export type ToolCallComplete = {
    tool_name: string
    status: string
    step_id: string
    changed_items: ChangedItem[]
    integration: string
    url?: string
    result?: string
    errorContext?: SharedErrorContext
}

export type FilterResult = { isRelevant: boolean; reason: string; confidence: number; step_id: string }

export type UserMessage = { message: string }

// Chat snippet types for displaying interactive elements in chat
export type ChatSnippet =
    | { type: "button"; label: string; url: string; id: string }
    | { type: "integration_prompt"; integration: string; message: string; id: string; stateToken?: string }
    | { type: "navigate"; path: string; id: string }
    | { type: "multiple_choice"; questionId: string; question: string; options: MultipleChoiceOption[]; id: string; allowMultiple?: boolean; selectedValue?: string }

export type ChatSnippetPayload =
    | { type: "button"; label: string; url: string }
    | { type: "integration_prompt"; integration: string; message: string; stateToken?: string }
    | { type: "navigate"; path: string }
    | { type: "multiple_choice"; questionId: string; question: string; options: MultipleChoiceOption[]; allowMultiple?: boolean }

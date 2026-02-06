import { EntityType } from "./Entities"

export enum ChangeEventType {
    CREATED = "CREATED",
    UPDATED = "UPDATED",
    ACTION_EXECUTED = "ACTION_EXECUTED"
}

export type SharedErrorContext = {
    error: Error | unknown
}

export type ChangedItem = { type_name: EntityType; id: string; change_event_type: ChangeEventType }

/**
 * Error categories for failures - used to determine UI treatment
 */
export type FailureCategory = "context_window_exceeded" | "rate_limit" | "authentication" | "tool_error" | "unknown"

export type Failure = {
    error: string
    step_id: string
    /**
     * Category of the failure - determines how the UI displays the error
     * and what guidance is shown to the user
     */
    category?: FailureCategory
    /**
     * User-friendly message suitable for UI display
     */
    userMessage?: string
    /**
     * Guidance for the user on how to proceed
     */
    userGuidance?: string
    /**
     * Whether this error is recoverable (user can retry or continue)
     */
    isRecoverable?: boolean
    /**
     * Source of the error (e.g., "github", "tool_output", "conversation_history")
     */
    source?: string
}

export type FunctionCall = { function_name: string; result: string; step_id: string }

export type ModelEvent =
    | ({ type: "ToolApprovalResponse" } & ToolApprovalResponse)
    | ({ type: "ToolApprovalRequest" } & ToolApprovalRequest)
    | ({ type: "ToolCallGenerating" } & ToolCallGenerating)
    | ({ type: "ToolCall" } & ToolCall)
    | ({ type: "ToolCallComplete" } & ToolCallComplete)
    | ({ type: "TextDelta" } & TextDelta)
    | ({ type: "Failure" } & Failure)
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

export type ChatSnippetPayload =
    | { type: "button"; label: string; url: string }
    | { type: "integration_prompt"; integration: string; message: string; stateToken?: string }
    | { type: "navigate"; path: string }

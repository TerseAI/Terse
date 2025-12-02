import { EntityType } from "./Entities";

export enum  ChangeEventType {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
    ACTION_EXECUTED = 'ACTION_EXECUTED',
}

export type ChangedItem = { type_name: EntityType, id: string, change_event_type: ChangeEventType };

export type Failure = { error: string, step_id: string };

export type FunctionCall = { function_name: string, result: string, step_id: string, };

export type ModelEvent = { "type": "ToolApprovalRequest" } & ToolApprovalRequest | { "type": "ToolCall" } & ToolCall | { "type": "ToolCallComplete" } & ToolCallComplete | { "type": "TextDelta" } & TextDelta | { "type": "Failure" } & Failure | { "type": "NaturalStop", step_id: string } | { "type": "FilterResult" } & FilterResult | { "type": "UserMessage" } & UserMessage;

export type ModelRequest = { "type": "SendModelRequest" } & SendModelRequest | { "type": "ToolApprovalResponse" } & ToolApprovalResponse;

export type SendModelRequest = { user_message: string, timezone: string, };

export type ToolApprovalResponse = { step_id: string, approved: boolean };

export type ToolApprovalRequest = { step_id: string, name: string, arguments: string };

export type TextDelta = { delta: string, step_id: string, };

export type ToolCall = { summary: string, step_id: string, parameters: string, integration: string, };

export type ToolCallComplete = { tool_name: string, status: string, step_id: string, changed_items: ChangedItem[], integration: string, url?: string, result?: string };

export type FilterResult = { isRelevant: boolean, reason: string, confidence: number, step_id: string };

export type UserMessage = { message: string };

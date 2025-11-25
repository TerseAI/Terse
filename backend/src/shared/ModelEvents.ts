import { EntityType } from "./Entities";

export enum ChangeEventType {
    CREATED = 'CREATED',
    UPDATED = 'UPDATED',
}

export type ChangedItem = { type_name: EntityType, id: string, change_event_type: ChangeEventType };

export type ActorReference = { id: string, actor_type: string, };

export type Failure = { error: string, };

export type FunctionCall = { function_name: string, result: string, step_id: string, };

export type ModelEvent = { "type": "ToolApprovalRequest" } & ToolApprovalRequest | { "type": "ToolCall" } & ToolCall | { "type": "ToolCallComplete" } & ToolCallComplete | { "type": "TextDelta" } & TextDelta | { "type": "Failure" } & Failure | { "type": "NaturalStop" } | { "type": "FilterResult" } & FilterResult;

export type ModelRequest = { "type": "SendModelRequest" } & SendModelRequest | { "type": "ToolApprovalResponse" } & ToolApprovalResponse;

export type SendModelRequest = { user_message: string, visible_actors: Array<ActorReference>, timezone: string, };

export type ToolApprovalResponse = { step_id: string, approved: boolean };

export type ToolApprovalRequest = { step_id: string, name: string, arguments: string };

export type TextDelta = { delta: string, step_id: string, };

export type ToolCall = { summary: string, step_id: string, parameters: string, };

export type ToolCallComplete = { tool_name: string, status: string, step_id: string, changed_items: ChangedItem[], integration?: string, url?: string };

export type FilterResult = { isRelevant: boolean, reason: string, confidence: number };

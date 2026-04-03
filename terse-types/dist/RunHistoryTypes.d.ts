import { ConfigType } from "./Configs.js";
import { IntegrationType } from "./Integrations.js";
import type { ModelEvent } from "./ModelEvents.js";
import type { User } from "./types.js";
export declare enum RunHistoryStatus {
    SUCCESS = "success",
    FAILED = "failed",
    CANCELLED = "cancelled",
    SKIPPED = "skipped",
    IN_PROGRESS = "in_progress",
    AWAITING_APPROVAL = "awaiting_approval"
}
export type RunHistoryDecisionAction = "processed" | "skipped";
export declare const RUN_HISTORY_ACTION_TYPES: readonly ["create", "update", "delete", "read", "approve", "error"];
export type RunHistoryActionType = (typeof RUN_HISTORY_ACTION_TYPES)[number];
export type RunHistoryAction = {
    action: string;
    integration: IntegrationType;
    target: string;
    details: string;
    url?: string;
    step_id?: string;
    type: RunHistoryActionType;
    isReadOnly?: boolean;
    output_items?: Array<{
        output_item_id: string;
        output_item_type: ConfigType;
    }>;
};
export type RunHistoryActionWithId = RunHistoryAction & {
    id: string;
};
export type RunHistoryTrigger = {
    event: string;
    integration: IntegrationType;
    source: string;
    title?: string;
    subheader?: string;
    url?: string;
};
export type RunHistoryDecision = {
    action: RunHistoryDecisionAction;
    reasoning: string;
};
export type RunHistoryRecord = {
    id: string;
    agentId: string;
    timestamp: string;
    trigger: RunHistoryTrigger;
    filtered: boolean;
    decision: RunHistoryDecision;
    actions?: RunHistoryAction[];
    status: RunHistoryStatus;
    isManuallyTriggered: boolean;
};
export type GetRunHistoryParamsRequest = {
    agentId: string;
};
export type GetRunHistoryParams = {
    q?: string;
    start?: string;
    end?: string;
    status?: RunHistoryStatus[];
    page?: number;
    pageSize?: number;
};
export type GetRunHistoryResponse = {
    items: RunHistoryRecord[];
    page: number;
    pageSize: number;
    total: number;
};
export type RunHistoryRecordWithAgent = RunHistoryRecord & {
    agentName: string;
};
export type GetAllRunHistoryResponse = {
    items: RunHistoryRecordWithAgent[];
    page: number;
    pageSize: number;
    total: number;
};
export type RunHistoryModelEvent = ModelEvent & {
    id: string;
};
export type RunHistoryModelSocketEvent = {
    runId: string;
    agentId: string;
    runHistoryModelEvent: RunHistoryModelEvent;
};
export type TrackingParams = {
    runId: string;
    agentId: string;
    user: User;
};

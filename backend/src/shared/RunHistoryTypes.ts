import { IntegrationType } from "./Integrations";
import type { ModelEvent } from "./ModelEvents";
import { ConfigType } from "./Configs";

export type RunHistoryStatus = "success" | "failed" | "skipped" | "in_progress" | "awaiting_approval";
export type RunHistoryDecisionAction = "processed" | "skipped";
export type RunHistoryActionType = "create" | "update" | "delete" | "read";

export type RunHistoryAction = {
   // What action was taken (free-text, e.g. "create database entry", "send notification")
   action: string;
   // Which integration this action targeted (used for icons and grouping)
   integration: IntegrationType;
   // The concrete target, e.g. database name, channel name, repo, inbox, etc.
   target: string;
   // Justification for the action or extra details about why the AI did this.
   details: string;
   // Link to the thing that got operated on.
   url?: string;
   // The step_id of the tool call that generated this action
   step_id?: string;
   // The type of action that was taken
   type: RunHistoryActionType;
   // Whether this action was from a read-only tool (e.g., query) vs a write tool (e.g., create/update)
   isReadOnly?: boolean;
   // Output item information for attribution tracking
   // Array because one action can modify multiple output items (e.g., appending multiple blocks)
   output_items?: Array<{
    output_item_id: string;
    output_item_type: ConfigType;
 }>;
}

export type RunHistoryActionWithId = RunHistoryAction & {
    id: string;
};

export type RunHistoryTrigger = {
    // What event occurred to trigger the run (free-text, e.g. "email received", "database row created")
    event: string;
    // Which integration this trigger came from (used for icons and grouping)
    integration: IntegrationType;
    // Source or context of the trigger (e.g. Gmail, Notion DB name, repo name)
    source: string;
    // Title of the trigger (Subject of the email, name of the database, etc.)
    title?: string;
    // Subheader of the trigger (From of the email, description of the database, etc.)
    subheader?: string;
    // Link to the trigger (Email URL, Database URL, etc.)
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
};

export type GetRunHistoryParams = {
    q?: string;
    start?: string; // ISO date string
    end?: string;   // ISO date string
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

export type RunHistoryModelEvent = ModelEvent & { id: string; timestamp?: string };

export type RunHistoryModelSocketEvent = {
    runId: string;
    agentId: string;
    runHistoryModelEvent: RunHistoryModelEvent;
};

export type RunHistoryStreamingParams = {
    runId?: string;
    userId?: string;
    agentId?: string;
};

export type RunHistoryStreamingParamsWithCallback = RunHistoryStreamingParams & {
    onEvent?: (event: ModelEvent) => Promise<void>;
};

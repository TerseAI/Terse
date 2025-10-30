export type RunHistoryStatus = "success" | "failed" | "skipped" | "in_progress";
export type RunHistoryDecisionAction = "processed" | "skipped";

export type Integration =
    | "jira"
    | "linear"
    | "slack"
    | "github"
    | "notion"
    | "gmail";

export type RunHistoryAction = {
    type: string;
    integration: Integration;
    target: string;
    details: string;
    url?: string;
};

export type RunHistoryTrigger = {
    type: string;
    integration: Integration;
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
    automationId: string;
    timestamp: string;
    trigger: RunHistoryTrigger;
    filtered: boolean;
    decision: RunHistoryDecision;
    actions?: RunHistoryAction[];
    status: RunHistoryStatus;
};



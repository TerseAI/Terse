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
    // What action was taken (free-text)
    type: string;
    // Which integration this action targeted
    integration: Integration;
    // What we are operating on (Database name, Inbox name, etc.)
    target: string;
    // Justification for the action or extra details about why the AI did this.
    details: string;
    // Link to thing that got operated on.
    url?: string;
};

export type RunHistoryTrigger = {
    // What event occurred to trigger the run (free-text)
    type: string;
    // Which integration this trigger came from
    integration: Integration;
    // Source of the trigger (Gmail, Notion database name, etc.)
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
    automationId: string;
    timestamp: string;
    trigger: RunHistoryTrigger;
    filtered: boolean;
    decision: RunHistoryDecision;
    actions?: RunHistoryAction[];
    status: RunHistoryStatus;
};



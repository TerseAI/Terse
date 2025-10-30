export type RunHistoryStatus = "success" | "failed" | "skipped" | "in_progress";
export type RunHistoryDecisionAction = "processed" | "skipped";

// Use free-form strings for what happened and what was done
// Use Integration enum (frontend) for which integration was involved for icons/branding
export type Integration =
    | "jira"
    | "linear"
    | "slack"
    | "github"
    | "notion"
    | "gmail";

export type RunHistoryAction = {
    // What action was taken (free-text, e.g. "create database entry", "send notification")
    type: string;
    // Which integration this action targeted (used for icons and grouping)
    integration: Integration;
    // The concrete target, e.g. database name, channel name, repo, inbox, etc.
    target: string;
    // Justification for the action or extra details about why the AI did this.
    details: string;
    // Link to the thing that got operated on.
    url?: string;
};

export type RunHistoryTrigger = {
    // What event occurred to trigger the run (free-text, e.g. "email received", "database row created")
    type: string;
    // Which integration this trigger came from (used for icons and grouping)
    integration: Integration;
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
    automationId: string;
    timestamp: string;
    trigger: RunHistoryTrigger;
    filtered: boolean;
    decision: RunHistoryDecision;
    actions?: RunHistoryAction[];
    status: RunHistoryStatus;
};



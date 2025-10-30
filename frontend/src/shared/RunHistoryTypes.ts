export type RunHistoryStatus = "success" | "failed" | "skipped" | "in_progress";
export type RunHistoryDecisionAction = "processed" | "skipped";

export type RunHistoryAction = {
    // System we are operating on (Notion, Gmail, etc.)
    type: string;
    // Target we are operating on (Notion database, Gmail inbox, etc.)
    target: string;
    // Justification for the action or extra details about why the AI did this.
    details: string;
    // Link to thing that got operated on.
    url?: string;
};

export type RunHistoryTrigger = {
    // Make this an enum
    type: string;
    source: string;
    // Change this to subject --> title and from --> subheader
    title?: string;
    subheader?: string;
    // Get rid of this
    preview?: string;
    // I want to link to something relevant for this run.
    url?: string;
};

export type RunHistoryDecision = {
    action: RunHistoryDecisionAction;
    reasoning: string;
    // Remove confidence
    confidence: number;
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



// Shared between the table header in RunHistoryList and the cells in RunHistoryRow so the two
// stay in lockstep. No column is hidden at small widths; the table scrolls horizontally instead.
export const RUN_HISTORY_COLUMN = {
    event: "w-full",
    job: "",
    type: "",
    triggeredBy: "",
    actions: "",
    status: "",
    time: "",
    retrigger: "w-11"
} as const

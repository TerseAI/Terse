// Shared between the table header in RunHistoryList and the cells in RunHistoryRow so the
// responsive hiding stays in lockstep.
export const RUN_HISTORY_COLUMN = {
    event: "",
    job: "hidden md:table-cell",
    detail: "hidden lg:table-cell w-full",
    type: "hidden sm:table-cell",
    triggeredBy: "hidden md:table-cell",
    actions: "hidden xl:table-cell text-right",
    status: "",
    time: "text-right",
    retrigger: "w-11"
} as const

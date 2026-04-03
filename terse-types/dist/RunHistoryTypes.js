export var RunHistoryStatus;
(function (RunHistoryStatus) {
    RunHistoryStatus["SUCCESS"] = "success";
    RunHistoryStatus["FAILED"] = "failed";
    RunHistoryStatus["CANCELLED"] = "cancelled";
    RunHistoryStatus["SKIPPED"] = "skipped";
    RunHistoryStatus["IN_PROGRESS"] = "in_progress";
    RunHistoryStatus["AWAITING_APPROVAL"] = "awaiting_approval";
})(RunHistoryStatus || (RunHistoryStatus = {}));
export const RUN_HISTORY_ACTION_TYPES = ["create", "update", "delete", "read", "approve", "error"];

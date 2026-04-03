export var TicketSystemType;
(function (TicketSystemType) {
    TicketSystemType["Jira"] = "jira";
    TicketSystemType["Linear"] = "linear";
    // Future ticket systems can be added here
})(TicketSystemType || (TicketSystemType = {}));
/**
 * Common Linear workflow state names.
 * Note: Teams can customize state names, but these are the defaults.
 */
export var LinearStateName;
(function (LinearStateName) {
    LinearStateName["Triage"] = "Triage";
    LinearStateName["Backlog"] = "Backlog";
    LinearStateName["Todo"] = "Todo";
    LinearStateName["InProgress"] = "In Progress";
    LinearStateName["InReview"] = "In Review";
    LinearStateName["Done"] = "Done";
    LinearStateName["Canceled"] = "Canceled";
})(LinearStateName || (LinearStateName = {}));

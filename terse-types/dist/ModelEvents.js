export var ChangeEventType;
(function (ChangeEventType) {
    ChangeEventType["CREATED"] = "CREATED";
    ChangeEventType["UPDATED"] = "UPDATED";
    ChangeEventType["ACTION_EXECUTED"] = "ACTION_EXECUTED";
})(ChangeEventType || (ChangeEventType = {}));
export var ToolCallExecutionStatus;
(function (ToolCallExecutionStatus) {
    ToolCallExecutionStatus["COMPLETED"] = "completed";
    ToolCallExecutionStatus["INCOMPLETE"] = "incomplete";
    ToolCallExecutionStatus["FAILED"] = "failed";
    ToolCallExecutionStatus["UNKNOWN"] = "unknown";
})(ToolCallExecutionStatus || (ToolCallExecutionStatus = {}));
export var SandboxStage;
(function (SandboxStage) {
    SandboxStage["DOWNLOADING_SOURCE"] = "downloading_source";
    SandboxStage["BOOTING"] = "booting";
    SandboxStage["INSTALLING_DEPENDENCIES"] = "installing_dependencies";
    SandboxStage["INSTALLING_CLI"] = "installing_cli";
    SandboxStage["RUNNING"] = "running";
})(SandboxStage || (SandboxStage = {}));
export const SANDBOX_STAGE_LABELS = {
    [SandboxStage.DOWNLOADING_SOURCE]: "Downloading source code",
    [SandboxStage.BOOTING]: "Booting sandbox",
    [SandboxStage.INSTALLING_DEPENDENCIES]: "Installing dependencies",
    [SandboxStage.INSTALLING_CLI]: "Installing CLI",
    [SandboxStage.RUNNING]: "Running agent"
};

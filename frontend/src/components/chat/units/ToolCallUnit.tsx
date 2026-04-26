import FunctionCallItem, { type FunctionCallEvent } from "../FunctionCallItem"
import type { ToolCallUnit as ToolCallUnitModel } from "../turnModel"

function toFunctionCallEvent(unit: ToolCallUnitModel): FunctionCallEvent {
    return {
        id: unit.unitId,
        name: unit.name,
        timestamp: unit.timestamp,
        isGeneratingParams: unit.status === "generating_params",
        isRunning: unit.status === "running" || unit.status === "approved_running",
        isWaitingForApproval: unit.status === "waiting_approval",
        isRejected: unit.status === "rejected",
        isApproved: unit.status === "approved_running" || unit.approval?.approved,
        isFailure: unit.status === "failed",
        parameters: unit.parameters,
        result: unit.result,
        changed_items: unit.changedItems,
        errorContext: unit.errorContext
    }
}

export function ToolCallUnit({
    unit,
    index,
    isTurnFailure,
    onApprove,
    onReject,
    onSendMessage
}: {
    unit: ToolCallUnitModel
    index: number
    isTurnFailure?: boolean
    onApprove?: (stepId: string) => void
    onReject?: (stepId: string) => void
    onSendMessage?: (message: string) => void
}) {
    return <FunctionCallItem call={toFunctionCallEvent(unit)} index={index} isTurnFailure={isTurnFailure} onApprove={onApprove} onReject={onReject} onSendMessage={onSendMessage} />
}

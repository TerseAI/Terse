import type { ToolApprovalResponseOptions } from "../../../socket"
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
    onApprove?: (stepId: string, options?: ToolApprovalResponseOptions) => void
    onReject?: (stepId: string, options?: ToolApprovalResponseOptions) => void
    onSendMessage?: (message: string) => void
}) {
    const handleApprove = onApprove ? (stepId: string, options?: ToolApprovalResponseOptions) => onApprove(stepId, { ...options, responseId: unit.responseId }) : undefined
    const handleReject = onReject ? (stepId: string, options?: ToolApprovalResponseOptions) => onReject(stepId, { ...options, responseId: unit.responseId }) : undefined
    return <FunctionCallItem call={toFunctionCallEvent(unit)} index={index} isTurnFailure={isTurnFailure} onApprove={handleApprove} onReject={handleReject} onSendMessage={onSendMessage} />
}

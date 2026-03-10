import { Ban, Check, MessageSquare } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { IconForIntegration } from "@/pages/Agents/components/Integration"
import type { ApprovalAction, ApprovalActionType, ApprovalRequest } from "@/shared/ApprovalTypes"
import { formatRelativeTime } from "@/utility/timeUtils"

import { RunHistoryStatus } from "../../shared/RunHistoryTypes"
import RunHistoryStatusBadge from "../RunHistory/RunHistoryStatusBadge"

type ApprovalRequestItemProps = {
    approval: ApprovalRequest
    onAction: (deepLink: string) => void
}

function convertApprovalStatusToRunHistoryStatus(status: ApprovalRequest["status"]): RunHistoryStatus {
    switch (status) {
        case "pending":
            return RunHistoryStatus.AWAITING_APPROVAL
        case "in_progress":
            return RunHistoryStatus.IN_PROGRESS
        case "completed":
            return RunHistoryStatus.SUCCESS
        default:
            throw status satisfies never
    }
}

function getIconForAction(actionType: ApprovalActionType) {
    switch (actionType) {
        case "open_run_history":
            return <MessageSquare className="w-4 h-4" />
        case "approve_action":
            return <Check className="w-4 h-4 text-success" />
        case "reject_action":
            return <Ban className="w-4 h-4 text-danger" />
    }
}

export default function ApprovalRequestItem({ approval, onAction }: ApprovalRequestItemProps) {
    const runHistoryStatus = convertApprovalStatusToRunHistoryStatus(approval.status)
    const actionOrder: ApprovalAction["type"][] = ["approve_action", "reject_action", "open_run_history"]
    const orderedActions = [...approval.actions].sort((a, b) => actionOrder.indexOf(a.type) - actionOrder.indexOf(b.type))

    return (
        <div className="h-[6.75rem] w-full overflow-hidden rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-start gap-3.5">
                <div className="mt-0.5 size-5 shrink-0 text-muted-foreground">
                    <IconForIntegration integration={approval.icon} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <p className="truncate text-sm font-medium text-foreground" title={approval.title}>
                            {approval.title}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(approval.timestamp)}</span>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={approval.subheader}>
                        {approval.subheader}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                        <RunHistoryStatusBadge status={runHistoryStatus} />
                        <div className="ml-auto flex items-center justify-end gap-2">
                            {orderedActions.map(action =>
                                action.type === "open_run_history" ? (
                                    <Button key={`${approval.id}-${action.deepLink}`} type="button" size="icon-sm" variant="outline" onClick={() => onAction(action.deepLink)} title="Open run history">
                                        {getIconForAction(action.type)}
                                    </Button>
                                ) : (
                                    <Button key={`${approval.id}-${action.deepLink}`} type="button" size="sm" variant="outline" onClick={() => onAction(action.deepLink)}>
                                        {getIconForAction(action.type)}
                                        {action.label}
                                    </Button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

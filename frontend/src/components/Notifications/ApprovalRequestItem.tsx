import { Ban, Check, MessageSquare } from "lucide-react"

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
        <div className="w-full overflow-hidden rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
                    <IconForIntegration integration={approval.icon} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate" title={approval.title}>
                            {approval.title}
                        </span>
                        <span className="flex-shrink-0 text-xs text-muted-foreground">{formatRelativeTime(approval.timestamp)}</span>
                    </div>

                    {approval.subheader && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={approval.subheader}>
                            {approval.subheader}
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-2.5 flex items-center gap-3 pl-11">
                <RunHistoryStatusBadge status={runHistoryStatus} />
                <div className="ml-auto flex items-center gap-2">
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
    )
}

import { MessageSquare } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconForIntegration } from "@/pages/Agents/components/Integration"
import type { ApprovalAction, ApprovalRequest } from "@/shared/ApprovalTypes"
import { formatRelativeTime } from "@/utility/timeUtils"

type ApprovalRequestItemProps = {
    approval: ApprovalRequest
    onAction: (deepLink: string) => void
}

function mapActionVariant(variant: ApprovalAction["variant"]): "default" | "destructive" | "outline" {
    switch (variant) {
        case "primary":
            return "default"
        case "destructive":
            return "destructive"
        case "outline":
            return "outline"
        default:
            throw variant satisfies never
    }
}

function getStatusBadgeProps(status: ApprovalRequest["status"]): { label: string; className: string } {
    switch (status) {
        case "pending":
            return { label: "Pending", className: "border-yellow-600/40 text-yellow-600 dark:text-yellow-400" }
        case "in_progress":
            return { label: "In progress", className: "border-accent/40 text-accent" }
        case "completed":
            return { label: "Completed", className: "border-green-600/40 text-green-600 dark:text-green-400" }
        default:
            throw status satisfies never
    }
}

export default function ApprovalRequestItem({ approval, onAction }: ApprovalRequestItemProps) {
    const statusBadge = getStatusBadgeProps(approval.status)
    const actionOrder: ApprovalAction["type"][] = ["approve_action", "reject_action", "open_run_history"]
    const orderedActions = [...approval.actions].sort((a, b) => actionOrder.indexOf(a.type) - actionOrder.indexOf(b.type))

    return (
        <div className="overflow-hidden rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-start gap-3.5">
                <div className="mt-0.5 size-5 shrink-0 text-muted-foreground">
                    <IconForIntegration integration={approval.icon} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground" title={approval.title}>
                            {approval.title}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(approval.timestamp)}</span>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={approval.subheader}>
                        {approval.subheader}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                        <Badge variant="outline" className={statusBadge.className}>
                            {statusBadge.label}
                        </Badge>

                        <div className="ml-auto flex items-center justify-end gap-2">
                            {orderedActions.map(action =>
                                action.type === "open_run_history" ? (
                                    <Button
                                        key={`${approval.id}-${action.deepLink}`}
                                        type="button"
                                        size="icon-sm"
                                        variant={mapActionVariant(action.variant)}
                                        onClick={() => onAction(action.deepLink)}
                                        title="Open run history"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                    </Button>
                                ) : (
                                    <Button key={`${approval.id}-${action.deepLink}`} type="button" size="sm" variant={mapActionVariant(action.variant)} onClick={() => onAction(action.deepLink)}>
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

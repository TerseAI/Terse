import { Link } from "react-router-dom"

import { ExternalLink, MessageSquare, Zap } from "lucide-react"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { RunHistoryRecordWithAgent, RunHistoryStatus } from "terse-types/RunHistoryTypes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/modules/agents/components/Integration"
import { useOpenRunDeepLink } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"
import { formatTimestamp } from "@/utils/time"

import RunHistoryStatusBadge from "./RunHistoryStatusBadge"
import RunTypeBadge from "./RunTypeBadge"
import TriggeredBy from "./TriggeredBy"

interface RunHistoryRowProps {
    run: RunHistoryRecordWithAgent
    onOpenChat: (run: RunHistoryRecordWithAgent) => void
    className?: string
}

export function RunHistoryRow({ run, onOpenChat, className }: RunHistoryRowProps) {
    const openRun = useOpenRunDeepLink()
    const title = run.trigger.title || run.trigger.source
    const writeActions = (run.actions ?? []).filter(a => a.type !== "read")

    return (
        <div role="listitem" className={cn("group flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-muted/40", className)}>
            {/* Integration icon */}
            <div className="shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
                <IconForIntegration integration={run.trigger.integration} />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onOpenChat(run)}
                        className="truncate rounded-sm text-left text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {title}
                    </button>
                    {run.trigger.url && (
                        <a
                            href={run.trigger.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            aria-label={`Open ${title} in new tab`}
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
                        >
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <Link
                        to={buildRoute(FrontendRoutes.JOBS.BY_ID, { id: run.agentId })}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
                        title={run.agentName}
                    >
                        {run.agentName}
                    </Link>
                    {run.trigger.subheader && (
                        <>
                            <span className="text-muted-foreground/40 shrink-0">·</span>
                            <span className="text-xs text-muted-foreground truncate">{run.trigger.subheader}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Run type + who triggered */}
            {(run.isTest || run.isManuallyTriggered || run.replayOfRunId) && (
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <RunTypeBadge isTest={run.isTest} isManuallyTriggered={run.isManuallyTriggered} replayOfRunId={run.replayOfRunId} onOpenOriginal={openRun} className="text-[10px]" />
                    {run.triggeredByUserId && <TriggeredBy userId={run.triggeredByUserId} showLabel={false} className="text-[10px]" />}
                </div>
            )}

            {/* Write actions count */}
            {writeActions.length > 0 && (
                <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="w-3 h-3" />
                    <span>
                        {writeActions.length} action{writeActions.length !== 1 ? "s" : ""}
                    </span>
                </div>
            )}

            {/* Status */}
            <RunHistoryStatusBadge status={run.status} className="hidden sm:flex" />
            <span className={cn("size-2 shrink-0 rounded-full sm:hidden", statusDot(run.status).className)}>
                <span className="sr-only">{statusDot(run.status).label}</span>
            </span>

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground whitespace-nowrap w-20 text-right">{formatTimestamp(run.timestamp)}</span>

            {/* Chat button */}
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={e => {
                    e.stopPropagation()
                    onOpenChat(run)
                }}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label="View run details"
            >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
        </div>
    )
}

function statusDot(status: RunHistoryStatus): { className: string; label: string } {
    switch (status) {
        case RunHistoryStatus.SUCCESS:
            return { className: "bg-success", label: "Success" }
        case RunHistoryStatus.SKIPPED:
            return { className: "bg-success", label: "Filtered" }
        case RunHistoryStatus.FAILED:
            return { className: "bg-danger", label: "Failed" }
        case RunHistoryStatus.CANCELLED:
            return { className: "bg-warning", label: "Cancelled" }
        case RunHistoryStatus.AWAITING_APPROVAL:
            return { className: "bg-warning", label: "Awaiting Approval" }
        case RunHistoryStatus.SUSPENDED:
            return { className: "bg-warning", label: "Suspended" }
        case RunHistoryStatus.IN_PROGRESS:
            return { className: "bg-muted-foreground animate-pulse", label: "In Progress" }
        default:
            throw status satisfies never
    }
}

import { useState } from "react"
import { Link } from "react-router-dom"

import { ExternalLink, RefreshCcw, Zap } from "lucide-react"
import { toast } from "sonner"
import { RunHistoryRecord, buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"

import { Button } from "@/components/ui/button"
import { BackendProvider } from "@/lib/http"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/modules/agents/components/Integration"
import { useOpenRunDeepLink } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"
import { formatTimestamp } from "@/utils/time"

import RunHistoryStatusBadge from "./RunHistoryStatusBadge"
import RunTypeBadge from "./RunTypeBadge"
import TriggeredBy from "./TriggeredBy"

export type RunHistoryRowRecord = RunHistoryRecord & { agentName?: string }

interface RunHistoryRowProps {
    run: RunHistoryRowRecord
    onOpenRun: (runId: string) => void
    className?: string
}

export function RunHistoryRow({ run, onOpenRun, className }: RunHistoryRowProps) {
    const openRun = useOpenRunDeepLink()
    const [isReTriggering, setIsReTriggering] = useState(false)
    const title = run.trigger.title || run.trigger.source
    const writeActions = (run.actions ?? []).filter(a => a.type !== "read")

    const handleReTrigger = async () => {
        if (isReTriggering) return
        setIsReTriggering(true)
        try {
            await BackendProvider.triggerWithEvent(run.agentId, undefined, run.id)
            toast.success("Run re-triggered")
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status
            if (status === 404) {
                toast.error("Could not re-trigger run: the original event or automation is no longer available")
            } else {
                toast.error("Failed to re-trigger run")
            }
        } finally {
            setIsReTriggering(false)
        }
    }

    return (
        <div role="listitem" onClick={() => onOpenRun(run.id)} className={cn("group flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-muted/40", className)}>
            {/* Integration icon */}
            <div className="shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
                <IconForIntegration integration={run.trigger.integration} />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation()
                            onOpenRun(run.id)
                        }}
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
                    {run.agentName && (
                        <Link
                            to={buildRoute(FrontendRoutes.JOBS.BY_ID, { id: run.agentId })}
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
                            title={run.agentName}
                        >
                            {run.agentName}
                        </Link>
                    )}
                    {run.agentName && run.trigger.subheader && <span className="text-muted-foreground/40 shrink-0">·</span>}
                    {run.trigger.subheader && <span className="text-xs text-muted-foreground truncate">{run.trigger.subheader}</span>}
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

            {/* Re-trigger */}
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={e => {
                    e.stopPropagation()
                    handleReTrigger()
                }}
                disabled={isReTriggering}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label="Re-trigger run"
                title="Re-trigger run"
            >
                <RefreshCcw className={cn("w-3.5 h-3.5", isReTriggering && "animate-spin")} aria-hidden="true" />
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

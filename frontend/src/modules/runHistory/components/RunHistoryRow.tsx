import { Link } from "react-router-dom"

import { ExternalLink, RefreshCcw, Zap } from "lucide-react"
import { RunHistoryRecord, buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/modules/agents/components/Integration"
import { useReTriggerRun } from "@/modules/runHistory/api/useReTriggerRun"
import { useOpenRunDeepLink } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"
import { formatTimestamp } from "@/utils/time"

import RunHistoryStatusBadge from "./RunHistoryStatusBadge"
import RunTypeBadge from "./RunTypeBadge"
import TriggeredBy from "./TriggeredBy"
import { RUN_HISTORY_COLUMN } from "./runHistoryColumns"

export type RunHistoryRowRecord = RunHistoryRecord & { agentName?: string }

interface RunHistoryRowProps {
    run: RunHistoryRowRecord
    onOpenRun: (runId: string) => void
    showJobColumn: boolean
    className?: string
}

export function RunHistoryRow({ run, onOpenRun, showJobColumn, className }: RunHistoryRowProps) {
    const openRun = useOpenRunDeepLink()
    const { reTriggerRun, isReTriggering } = useReTriggerRun({ agentId: run.agentId, runId: run.id })
    const title = run.trigger.title || run.trigger.source
    const writeActions = (run.actions ?? []).filter(a => a.type !== "read")
    const hasRunType = Boolean(run.isTest || run.isManuallyTriggered || run.replayOfRunId)

    return (
        <TableRow onClick={() => onOpenRun(run.id)} className={cn("group cursor-pointer border-border/40", className)}>
            <TableCell className={cn(RUN_HISTORY_COLUMN.event, "py-2.5 pl-4")}>
                <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                        <IconForIntegration integration={run.trigger.integration} />
                    </div>
                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation()
                            onOpenRun(run.id)
                        }}
                        className="max-w-[260px] truncate rounded-sm text-left text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                            className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 group-hover:opacity-100"
                        >
                            <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                    )}
                </div>
            </TableCell>

            {showJobColumn && (
                <TableCell className={RUN_HISTORY_COLUMN.job}>
                    {run.agentName ? (
                        <Link
                            to={buildRoute(FrontendRoutes.JOBS.BY_ID, { id: run.agentId })}
                            onClick={e => e.stopPropagation()}
                            title={run.agentName}
                            className="block max-w-[160px] truncate rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                        >
                            {run.agentName}
                        </Link>
                    ) : (
                        <EmptyCell />
                    )}
                </TableCell>
            )}

            <TableCell className={RUN_HISTORY_COLUMN.type}>
                {hasRunType ? (
                    <RunTypeBadge isTest={run.isTest} isManuallyTriggered={run.isManuallyTriggered} replayOfRunId={run.replayOfRunId} onOpenOriginal={openRun} className="text-[10px]" />
                ) : (
                    <EmptyCell />
                )}
            </TableCell>

            <TableCell className={RUN_HISTORY_COLUMN.triggeredBy}>{run.triggeredByUserId ? <TriggeredBy userId={run.triggeredByUserId} showLabel={false} /> : <EmptyCell />}</TableCell>

            <TableCell className={RUN_HISTORY_COLUMN.actions}>
                {writeActions.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Zap className="size-3" aria-hidden="true" />
                        {writeActions.length}
                    </span>
                ) : (
                    <EmptyCell />
                )}
            </TableCell>

            <TableCell className={RUN_HISTORY_COLUMN.status}>
                <RunHistoryStatusBadge status={run.status} />
            </TableCell>

            <TableCell className={cn(RUN_HISTORY_COLUMN.time, "text-xs text-muted-foreground")}>{formatTimestamp(run.timestamp)}</TableCell>

            <TableCell className={cn(RUN_HISTORY_COLUMN.retrigger, "pr-2.5")}>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={e => {
                        e.stopPropagation()
                        reTriggerRun()
                    }}
                    disabled={isReTriggering}
                    className="size-7 text-muted-foreground/60 transition-colors hover:text-foreground group-hover:text-muted-foreground"
                    aria-label="Re-trigger run"
                    title="Re-trigger run"
                >
                    <RefreshCcw className={cn("size-3.5", isReTriggering && "animate-spin")} aria-hidden="true" />
                </Button>
            </TableCell>
        </TableRow>
    )
}

function EmptyCell() {
    return (
        <span className="text-muted-foreground/40" aria-hidden="true">
            &mdash;
        </span>
    )
}

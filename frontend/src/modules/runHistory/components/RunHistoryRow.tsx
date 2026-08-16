import { Link } from "react-router-dom"

import { ExternalLink, Zap } from "lucide-react"
import { RunHistoryRecord, buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/modules/agents/components/Integration"
import { useOpenRunDeepLink } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"
import { formatTimestamp } from "@/utils/time"

import RunHistoryStatusBadge from "./RunHistoryStatusBadge"
import RunTypeBadge, { TriggerSourceLabel } from "./RunTypeBadge"
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
    const title = run.trigger.title || run.trigger.source
    const writeActions = (run.actions ?? []).filter(a => a.type !== "read")
    const hasRunType = Boolean(run.isTest || run.isManuallyTriggered || run.replayOfRunId)

    return (
        <TableRow onClick={() => onOpenRun(run.id)} className={cn("group cursor-pointer border-border/40", className)}>
            <TableCell className={cn(RUN_HISTORY_COLUMN.event, "py-2.5 pl-4")}>
                <div className="flex items-center gap-2">
                    <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                        <IconForIntegration integration={run.trigger.integration} />
                    </span>
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
                    <RunTypeBadge isTest={run.isTest} isManuallyTriggered={run.isManuallyTriggered} replayOfRunId={run.replayOfRunId} onOpenOriginal={openRun} className="text-xs" />
                ) : (
                    <TriggerSourceLabel integration={run.trigger.integration} />
                )}
            </TableCell>

            <TableCell className={RUN_HISTORY_COLUMN.triggeredBy}>
                {run.triggeredByUserId ? (
                    <TriggeredBy userId={run.triggeredByUserId} showLabel={false} />
                ) : run.trigger.source ? (
                    <span title={run.trigger.source} className="block max-w-[160px] truncate text-xs text-muted-foreground">
                        {run.trigger.source}
                    </span>
                ) : (
                    <EmptyCell />
                )}
            </TableCell>

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

            <TableCell className={cn(RUN_HISTORY_COLUMN.time, "pr-4 text-xs text-muted-foreground")}>{formatTimestamp(run.timestamp)}</TableCell>
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

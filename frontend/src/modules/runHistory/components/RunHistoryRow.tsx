import { useNavigate } from "react-router-dom"

import { ExternalLink, MessageSquare, Zap } from "lucide-react"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { RunHistoryRecordWithAgent } from "terse-types/RunHistoryTypes"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/modules/agents/components/Integration"
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
    const navigate = useNavigate()
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
                    <span className="text-sm font-medium text-foreground truncate">{title}</span>
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
                    <button
                        onClick={() => navigate(buildRoute(FrontendRoutes.JOBS.BY_ID, { id: run.agentId }))}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[160px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
                        title={run.agentName}
                    >
                        {run.agentName}
                    </button>
                    {run.trigger.subheader && (
                        <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{run.trigger.subheader}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Run type + who triggered */}
            {(run.isTest || run.isManuallyTriggered) && (
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                    <RunTypeBadge isTest={run.isTest} isManuallyTriggered={run.isManuallyTriggered} className="text-[10px]" />
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

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground whitespace-nowrap w-20 text-right">{formatTimestamp(run.timestamp)}</span>

            {/* Chat button */}
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChat(run)}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label="View run details"
            >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
        </div>
    )
}

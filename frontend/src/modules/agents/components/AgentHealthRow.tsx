import { Link } from "react-router-dom"

import { PauseCircle } from "lucide-react"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { type RunHistoryRecordWithAgent, RunHistoryStatus } from "terse-types/RunHistoryTypes"
import type { Agent } from "terse-types/types"

import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/utils/time"

const HEALTH_WINDOW = 20
const STRIP_LENGTH = 10
const FAILURE_STREAK_THRESHOLD = 3

export const ALL_RUN_STATUSES = new Set([
    RunHistoryStatus.SUCCESS,
    RunHistoryStatus.FAILED,
    RunHistoryStatus.CANCELLED,
    RunHistoryStatus.SKIPPED,
    RunHistoryStatus.IN_PROGRESS,
    RunHistoryStatus.AWAITING_APPROVAL
])

export type HealthStatus = "failing" | "healthy" | "no_runs" | "paused"

export type AgentHealth = {
    status: HealthStatus
    successRate: number | null
    successCount: number
    failureCount: number
    lastRun: RunHistoryRecordWithAgent | null
    strip: RunHistoryRecordWithAgent[]
}

export const HEALTH_RANK: Record<HealthStatus, number> = {
    failing: 0,
    paused: 1,
    no_runs: 2,
    healthy: 3
}

export function AgentRow({ agent, health }: { agent: Agent; health: AgentHealth }) {
    const agentRoute = buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: agent.id })
    const isUnhealthy = health.status === "failing"

    return (
        <li className="group hover:bg-muted/50 focus-within:bg-muted/50 relative transition-colors">
            <Link to={agentRoute} aria-label={`Open ${agent.name}`} className="focus-visible:ring-ring/50 absolute inset-0 z-0 rounded-sm focus:outline-none focus-visible:ring-2" />
            <div className="pointer-events-none relative flex items-center gap-4 px-3 py-3.5">
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", healthDotColor(health.status))} aria-hidden />
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-foreground truncate text-sm font-medium">{agent.name}</span>
                            {health.status === "failing" && <span className="text-danger text-xs font-medium">Failing</span>}
                            {health.status === "paused" && (
                                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                    <PauseCircle className="h-3 w-3" />
                                    Paused
                                </span>
                            )}
                            {health.status === "no_runs" && <span className="text-muted-foreground text-xs">No runs yet</span>}
                        </div>
                        {health.lastRun && <div className="text-muted-foreground mt-0.5 text-xs tabular-nums">Last run {formatTimestamp(health.lastRun.timestamp)}</div>}
                    </div>
                </div>

                <div className="pointer-events-auto relative z-10 hidden shrink-0 items-center gap-0.5 sm:flex" aria-label="Recent runs">
                    {Array.from({ length: STRIP_LENGTH }).map((_, i) => {
                        const run = health.strip[STRIP_LENGTH - 1 - i]
                        return <RunDot key={i} run={run} agentId={agent.id} />
                    })}
                </div>

                <div className="hidden w-16 shrink-0 text-right md:block">
                    {health.successRate === null ? (
                        <div className="text-muted-foreground text-xs">no data</div>
                    ) : (
                        <>
                            <div className={cn("text-sm font-medium tabular-nums", isUnhealthy ? "text-danger" : "text-foreground")}>{Math.round(health.successRate * 100)}%</div>
                            <div className="text-muted-foreground text-xs tabular-nums">{health.successCount + health.failureCount} runs</div>
                        </>
                    )}
                </div>
            </div>
        </li>
    )
}

function RunDot({ run, agentId }: { run: RunHistoryRecordWithAgent | undefined; agentId: string }) {
    if (!run) {
        return <span className="bg-muted-foreground/25 block h-4 w-1 rounded-sm" aria-hidden />
    }
    const runRoute = buildRoute(FrontendRoutes.AGENTS.RUN_HISTORY, { id: agentId, runId: run.id })
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    to={runRoute}
                    aria-label={`Open run from ${formatTimestamp(run.timestamp)}`}
                    className={cn("focus-visible:ring-ring block h-4 w-1 rounded-sm transition-transform hover:scale-y-110 focus:outline-none focus-visible:ring-1", runDotColor(run.status))}
                />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                <div className="font-medium capitalize">{run.status.replace(/_/g, " ")}</div>
                <div className="text-muted-foreground">{formatTimestamp(run.timestamp)}</div>
            </TooltipContent>
        </Tooltip>
    )
}

export function AgentRowsSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="divide-border/60 border-border/60 divide-y border-y">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-3 py-3.5">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="hidden items-center gap-1 sm:flex">
                        {Array.from({ length: STRIP_LENGTH }).map((_, j) => (
                            <Skeleton key={j} className="h-4 w-1 rounded-sm" />
                        ))}
                    </div>
                    <Skeleton className="hidden h-4 w-12 md:block" />
                </div>
            ))}
        </div>
    )
}

export function groupRunsByAgent(runs: RunHistoryRecordWithAgent[]) {
    const map = new Map<string, RunHistoryRecordWithAgent[]>()
    for (const run of runs) {
        const list = map.get(run.agentId)
        if (list) {
            list.push(run)
        } else {
            map.set(run.agentId, [run])
        }
    }
    return map
}

export function computeHealth(agent: Agent, runs: RunHistoryRecordWithAgent[]): AgentHealth {
    const recent = runs.slice(0, HEALTH_WINDOW)

    if (!agent.isActive) {
        return {
            status: "paused",
            successRate: null,
            successCount: 0,
            failureCount: 0,
            lastRun: recent[0] ?? null,
            strip: recent.slice(0, STRIP_LENGTH)
        }
    }

    if (recent.length === 0) {
        return {
            status: "no_runs",
            successRate: null,
            successCount: 0,
            failureCount: 0,
            lastRun: null,
            strip: []
        }
    }

    let successCount = 0
    let failureCount = 0
    for (const run of recent) {
        if (run.status === RunHistoryStatus.SUCCESS) successCount++
        else if (run.status === RunHistoryStatus.FAILED) failureCount++
    }
    const total = successCount + failureCount
    const successRate = total > 0 ? successCount / total : null

    let streak = 0
    for (const run of recent) {
        if (run.status === RunHistoryStatus.FAILED) streak++
        else if (run.status === RunHistoryStatus.SUCCESS) break
    }
    const isFailing = streak >= FAILURE_STREAK_THRESHOLD

    return {
        status: isFailing ? "failing" : "healthy",
        successRate,
        successCount,
        failureCount,
        lastRun: recent[0],
        strip: recent.slice(0, STRIP_LENGTH)
    }
}

function healthDotColor(status: HealthStatus) {
    switch (status) {
        case "failing":
            return "bg-danger"
        case "healthy":
            return "bg-success"
        case "paused":
            return "bg-muted-foreground/50"
        case "no_runs":
            return "bg-success"
    }
}

function runDotColor(status: RunHistoryStatus) {
    switch (status) {
        case RunHistoryStatus.SUCCESS:
            return "bg-success"
        case RunHistoryStatus.FAILED:
            return "bg-danger"
        case RunHistoryStatus.IN_PROGRESS:
            return "bg-accent-tertiary animate-pulse"
        case RunHistoryStatus.AWAITING_APPROVAL:
            return "bg-warning"
        case RunHistoryStatus.CANCELLED:
            return "bg-muted-foreground/50"
        case RunHistoryStatus.SKIPPED:
            return "bg-muted-foreground/40"
        default:
            return "bg-muted"
    }
}

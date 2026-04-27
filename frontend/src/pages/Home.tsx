import { useState } from "react"
import { Link } from "react-router-dom"

import { AlertTriangle, ArrowRight, Check, Copy, PauseCircle, Terminal } from "lucide-react"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { type RunHistoryRecordWithAgent, RunHistoryStatus } from "terse-types/RunHistoryTypes"
import type { Agent } from "terse-types/types"

import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAgents } from "@/hooks/api/useAgents"
import { useAllRunHistory } from "@/hooks/api/useAllRunHistory"
import { usePendingApprovals } from "@/hooks/api/usePendingApprovals"
import { cn } from "@/lib/utils"
import { formatTimestamp } from "@/utility/timeUtils"

const HEALTH_WINDOW = 20
const STRIP_LENGTH = 10
const FAILURE_STREAK_THRESHOLD = 3
const RUN_FETCH_PAGE_SIZE = 200

const ALL_RUN_STATUSES = new Set([
    RunHistoryStatus.SUCCESS,
    RunHistoryStatus.FAILED,
    RunHistoryStatus.CANCELLED,
    RunHistoryStatus.SKIPPED,
    RunHistoryStatus.IN_PROGRESS,
    RunHistoryStatus.AWAITING_APPROVAL
])

type HealthStatus = "failing" | "healthy" | "no_runs" | "paused"

type AgentHealth = {
    status: HealthStatus
    successRate: number | null
    successCount: number
    failureCount: number
    lastRun: RunHistoryRecordWithAgent | null
    strip: RunHistoryRecordWithAgent[]
}

const HEALTH_RANK: Record<HealthStatus, number> = {
    failing: 0,
    paused: 1,
    no_runs: 2,
    healthy: 3
}

export default function HomePage() {
    const { agents, isLoading: agentsLoading } = useAgents({ limit: 100 })
    const { runs, isLoading: runsLoading } = useAllRunHistory({
        page: 1,
        pageSize: RUN_FETCH_PAGE_SIZE,
        selectedStatuses: ALL_RUN_STATUSES
    })
    const { approvals, isLoading: approvalsLoading } = usePendingApprovals({ status: "pending" })

    const runsByAgent = groupRunsByAgent(runs)
    const agentsWithHealth = agents
        .map(agent => ({ agent, health: computeHealth(agent, runsByAgent.get(agent.id) ?? []) }))
        .sort((a, b) => {
            const rank = HEALTH_RANK[a.health.status] - HEALTH_RANK[b.health.status]
            if (rank !== 0) return rank
            return a.agent.name.localeCompare(b.agent.name)
        })

    if (!agentsLoading && agents.length === 0) {
        return (
            <div className="h-full overflow-y-auto">
                <EmptyState />
            </div>
        )
    }

    const isLoading = agentsLoading || runsLoading

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-6 py-10 space-y-8">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Home</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Agent health across your org.</p>
                </header>

                {!approvalsLoading && approvals.length > 0 && <ApprovalsStrip count={approvals.length} />}

                {isLoading ? (
                    <section>
                        <AgentTableSkeleton />
                    </section>
                ) : (
                    <TooltipProvider delayDuration={150}>
                        <div className="space-y-8">
                            {groupAgents(agentsWithHealth).map(group => (
                                <ProjectGroup key={group.key} group={group} />
                            ))}
                        </div>
                    </TooltipProvider>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Approvals strip
// ---------------------------------------------------------------------------

function ApprovalsStrip({ count }: { count: number }) {
    return (
        <Link to={FrontendRoutes.NOTIFICATIONS} className="group flex items-center gap-3 rounded-md bg-warning/10 px-4 py-2.5 text-sm transition-colors hover:bg-warning/15">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="flex-1 text-foreground">
                <span className="font-medium tabular-nums">{count}</span> {count === 1 ? "approval waiting on you" : "approvals waiting on you"}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                Review
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
        </Link>
    )
}

// ---------------------------------------------------------------------------
// Agent row
// ---------------------------------------------------------------------------

function AgentRow({ agent, health }: { agent: Agent; health: AgentHealth }) {
    const agentRoute = buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: agent.id })
    const isUnhealthy = health.status === "failing"

    return (
        <li className="group relative transition-colors hover:bg-muted/50 focus-within:bg-muted/50">
            <Link
                to={agentRoute}
                aria-label={`Open ${agent.name}`}
                className="absolute inset-0 z-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm"
            />
            <div className="relative pointer-events-none flex items-center gap-4 px-3 py-3.5">
                <div className="flex-1 min-w-0 flex items-start gap-2.5">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", healthDotColor(health.status))} aria-hidden />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="truncate text-sm font-medium text-foreground">{agent.name}</span>
                            {health.status === "failing" && <span className="text-xs font-medium text-danger">Failing</span>}
                            {health.status === "paused" && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <PauseCircle className="h-3 w-3" />
                                    Paused
                                </span>
                            )}
                            {health.status === "no_runs" && <span className="text-xs text-muted-foreground">No runs yet</span>}
                        </div>
                        {health.lastRun && <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">Last run {formatTimestamp(health.lastRun.timestamp)}</div>}
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-0.5 shrink-0 pointer-events-auto relative z-10" aria-label="Recent runs">
                    {Array.from({ length: STRIP_LENGTH }).map((_, i) => {
                        const run = health.strip[STRIP_LENGTH - 1 - i]
                        return <RunDot key={i} run={run} agentId={agent.id} />
                    })}
                </div>

                <div className="hidden md:block w-16 text-right shrink-0">
                    {health.successRate === null ? (
                        <div className="text-xs text-muted-foreground">no data</div>
                    ) : (
                        <>
                            <div className={cn("text-sm font-medium tabular-nums", isUnhealthy ? "text-danger" : "text-foreground")}>{Math.round(health.successRate * 100)}%</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{health.successCount + health.failureCount} runs</div>
                        </>
                    )}
                </div>
            </div>
        </li>
    )
}

function RunDot({ run, agentId }: { run: RunHistoryRecordWithAgent | undefined; agentId: string }) {
    if (!run) {
        return <span className="block h-4 w-1 rounded-sm bg-muted-foreground/25" aria-hidden />
    }
    const runRoute = buildRoute(FrontendRoutes.AGENTS.RUN_HISTORY, { id: agentId, runId: run.id })
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    to={runRoute}
                    aria-label={`Open run from ${formatTimestamp(run.timestamp)}`}
                    className={cn(
                        "block h-4 w-1 rounded-sm transition-transform hover:scale-y-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        runDotColor(run.status)
                    )}
                />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
                <div className="font-medium capitalize">{run.status.replace(/_/g, " ")}</div>
                <div className="text-muted-foreground">{formatTimestamp(run.timestamp)}</div>
            </TooltipContent>
        </Tooltip>
    )
}

// ---------------------------------------------------------------------------
// Project group
// ---------------------------------------------------------------------------

type AgentWithHealth = { agent: Agent; health: AgentHealth }
type AgentGroupData = {
    key: string
    projectId: string | null
    projectName: string
    agents: AgentWithHealth[]
}

function ProjectGroup({ group }: { group: AgentGroupData }) {
    return (
        <section>
            <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.projectName}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {group.agents.length} {group.agents.length === 1 ? "agent" : "agents"}
                </span>
            </div>
            <ul className="divide-y divide-border/60 border-y border-border/60">
                {group.agents.map(({ agent, health }) => (
                    <AgentRow key={agent.id} agent={agent} health={health} />
                ))}
            </ul>
        </section>
    )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const CLI_LINES = ["npm i -g terse-cli", "terse init my-agent"]

function EmptyState() {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        void navigator.clipboard.writeText(CLI_LINES.join("\n"))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="min-h-full flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-md">
                <div className="flex items-center gap-2 mb-10">
                    <span className="block h-2 w-2 rounded-full bg-success" aria-hidden />
                    <span className="font-mono text-sm tracking-tight text-foreground">terse</span>
                </div>

                <h1 className="text-xl font-semibold tracking-tight text-foreground">Build your first agent from your terminal.</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Terse agents are built locally. Run the commands below to get started.</p>

                <div className="mt-6 group relative">
                    <pre className="rounded-md bg-muted/60 border border-border/60 px-4 py-3 font-mono text-sm text-foreground">
                        {CLI_LINES.map(line => (
                            <div key={line} className="flex">
                                <span className="select-none text-muted-foreground pr-3">$</span>
                                <span>{line}</span>
                            </div>
                        ))}
                    </pre>
                    <button
                        type="button"
                        onClick={handleCopy}
                        aria-label="Copy commands"
                        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>

                <div className="mt-6 flex items-center gap-4 text-sm">
                    <a href="https://docs.useterse.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Terminal className="h-3.5 w-3.5" />
                        Read the docs
                        <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function AgentTableSkeleton() {
    return (
        <div className="divide-y divide-border/60 border-y border-border/60">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-3 py-3.5">
                    <div className="flex-1 min-w-0 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="hidden sm:flex items-center gap-1">
                        {Array.from({ length: STRIP_LENGTH }).map((_, j) => (
                            <Skeleton key={j} className="h-4 w-1 rounded-sm" />
                        ))}
                    </div>
                    <Skeleton className="hidden md:block h-4 w-12" />
                </div>
            ))}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupAgents(items: AgentWithHealth[]): AgentGroupData[] {
    const buckets = new Map<string, AgentGroupData>()
    for (const item of items) {
        const projectId = item.agent.metadata?.projectId ?? null
        const projectName = item.agent.metadata?.projectName ?? "Unassigned"
        const key = projectId ?? "__unassigned__"
        const existing = buckets.get(key)
        if (existing) {
            existing.agents.push(item)
        } else {
            buckets.set(key, { key, projectId, projectName, agents: [item] })
        }
    }
    return Array.from(buckets.values()).sort((a, b) => {
        const aWorst = Math.min(...a.agents.map(x => HEALTH_RANK[x.health.status]))
        const bWorst = Math.min(...b.agents.map(x => HEALTH_RANK[x.health.status]))
        if (aWorst !== bWorst) return aWorst - bWorst
        if (a.projectId === null) return 1
        if (b.projectId === null) return -1
        return a.projectName.localeCompare(b.projectName)
    })
}

function groupRunsByAgent(runs: RunHistoryRecordWithAgent[]) {
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

function computeHealth(agent: Agent, runs: RunHistoryRecordWithAgent[]): AgentHealth {
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
            return "bg-border"
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

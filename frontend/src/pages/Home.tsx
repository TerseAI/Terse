import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Check, Copy, Sparkles, Terminal } from "lucide-react"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { type RunHistoryRecordWithAgent, RunHistoryStatus } from "terse-types/RunHistoryTypes"

import { RunHistoryRow } from "@/components/RunHistory/RunHistoryRow"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllRunHistory } from "@/hooks/api/useAllRunHistory"
import { usePendingApprovals } from "@/hooks/api/usePendingApprovals"
import { useStats } from "@/hooks/api/useStats"
import { cn } from "@/lib/utils"
import { useRunHistoryChatDrawer } from "@/services/RunHistoryChatDrawerContext"
import { formatNumber, formatTimestamp, getTrend } from "@/utility/timeUtils"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value, change }: { label: string; value: string; change: string }) {
    const trend = getTrend(change)
    return (
        <Card className="py-4 gap-2">
            <CardHeader className="pb-0">
                <CardDescription className="text-xs font-medium tracking-wide uppercase">{label}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2.5">
                    <span className="text-3xl font-semibold tracking-tight text-foreground">{value}</span>
                    <span className={cn("text-sm font-medium", trend === "up" ? "text-success" : "text-danger")}>{change}</span>
                </div>
            </CardContent>
        </Card>
    )
}

function ActivityLoadingSkeleton() {
    return (
        <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-3/4 max-w-[280px]" />
                        <Skeleton className="h-3 w-1/2 max-w-[180px]" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
                    <Skeleton className="h-3 w-12" />
                </div>
            ))}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Quickstart empty state
// ---------------------------------------------------------------------------

const CLI_SNIPPET = `npm install -g terse-cli\nterse init my-project`

function QuickstartEmptyState() {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        void navigator.clipboard.writeText(CLI_SNIPPET)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="flex items-center justify-center min-h-[60vh] px-6 py-12">
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <Sparkles className="text-primary" />
                    </EmptyMedia>
                    <EmptyTitle>Welcome to Terse</EmptyTitle>
                    <EmptyDescription>Build agents that handle the work around your code.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <div className="w-full rounded-lg border border-border bg-muted/50 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Terminal className="h-3.5 w-3.5" />
                                Terminal
                            </div>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? "Copied!" : "Copy"}
                            </button>
                        </div>
                        <pre className="px-4 py-3 text-sm font-mono text-foreground whitespace-pre">{CLI_SNIPPET}</pre>
                    </div>
                    <div className="flex gap-3 w-full">
                        <a
                            href="https://docs.useterse.ai"
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 flex items-center justify-center h-9 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                            Read the docs
                        </a>
                        <Link
                            to={FrontendRoutes.AGENTS.NEW}
                            className="flex-1 flex items-center justify-center h-9 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
                        >
                            Build in the browser
                        </Link>
                    </div>
                </EmptyContent>
            </Empty>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Needs attention panels
// ---------------------------------------------------------------------------

function PendingApprovalsPanel() {
    const navigate = useNavigate()
    const { approvals, isLoading } = usePendingApprovals({ status: "pending" })
    const displayed = approvals.slice(0, 5)

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Awaiting your approval
                    {approvals.length > 0 && (
                        <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                            {approvals.length}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-12 w-full rounded-lg" />
                        ))}
                    </div>
                ) : displayed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing waiting on you.</p>
                ) : (
                    <div className="space-y-1">
                        {displayed.map(approval => (
                            <button
                                key={approval.id}
                                type="button"
                                onClick={() => navigate(FrontendRoutes.NOTIFICATIONS)}
                                className="w-full flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{approval.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{approval.subheader}</p>
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                                    {formatTimestamp(approval.timestamp)}
                                </span>
                            </button>
                        ))}
                        {approvals.length > 5 && (
                            <div className="pt-1">
                                <Link
                                    to={FrontendRoutes.NOTIFICATIONS}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    See all {approvals.length} →
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function RecentFailuresPanel() {
    const navigate = useNavigate()
    const { runs: failedRuns, isLoading } = useAllRunHistory({
        page: 1,
        pageSize: 20,
        selectedStatuses: new Set([RunHistoryStatus.FAILED])
    })

    const failingAgents = useMemo(() => {
        const seen = new Map<string, { run: RunHistoryRecordWithAgent; count: number }>()
        for (const run of failedRuns) {
            if (!seen.has(run.agentId)) {
                seen.set(run.agentId, { run, count: 1 })
            } else {
                seen.get(run.agentId)!.count++
            }
        }
        return Array.from(seen.values()).slice(0, 5)
    }, [failedRuns])

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>Recent failures</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-12 w-full rounded-lg" />
                        ))}
                    </div>
                ) : failingAgents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No failures in the last 24h.</p>
                ) : (
                    <div className="space-y-1">
                        {failingAgents.map(({ run, count }) => (
                            <button
                                key={run.agentId}
                                type="button"
                                onClick={() => navigate(buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: run.agentId }))}
                                className="w-full flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{run.agentName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {count} failure{count !== 1 ? "s" : ""} in window
                                    </p>
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
                                    {formatTimestamp(run.timestamp)}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ALL_STATUSES = new Set([
    RunHistoryStatus.SUCCESS,
    RunHistoryStatus.FAILED,
    RunHistoryStatus.CANCELLED,
    RunHistoryStatus.SKIPPED,
    RunHistoryStatus.IN_PROGRESS,
    RunHistoryStatus.AWAITING_APPROVAL
])

export default function HomePage() {
    const { stats, isLoading: statsLoading } = useStats("24h")
    const { runs: teaserRuns, total: teaserTotal, isLoading: teaserLoading } = useAllRunHistory({
        page: 1,
        pageSize: 8,
        selectedStatuses: ALL_STATUSES
    })
    const { openDrawer } = useRunHistoryChatDrawer()

    const isNewUser = !statsLoading && !teaserLoading && (stats?.numberOfAgents ?? 0) === 0 && teaserTotal === 0

    if (isNewUser) {
        return (
            <div className="h-full overflow-y-auto">
                <QuickstartEmptyState />
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full px-6 py-8 space-y-6">
                {/* ── Page header ──────────────────────────────────────── */}
                <div>
                    <h1 className="text-2xl font-semibold text-foreground tracking-tight">Home</h1>
                    <p className="text-muted-foreground mt-1 text-sm">What needs your attention right now.</p>
                </div>

                {/* ── Needs attention ───────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <PendingApprovalsPanel />
                    <RecentFailuresPanel />
                </div>

                {/* ── At a glance ───────────────────────────────────────── */}
                {statsLoading || !stats ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="py-4 gap-2">
                                <CardHeader className="pb-0">
                                    <Skeleton className="h-3 w-24" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-8 w-20" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard label="Events Processed" value={formatNumber(stats.totalEventsProcessed)} change={stats.totalEventsProcessedChange} />
                        <StatCard label="Actions Taken" value={formatNumber(stats.actionsTaken)} change={stats.actionsTakenChange} />
                        <StatCard label="Active Agents" value={formatNumber(stats.numberOfAgents)} change={stats.numberOfAgentsChange} />
                    </div>
                )}

                {/* ── Recent activity teaser ────────────────────────────── */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent activity</CardTitle>
                        <CardAction>
                            <Link to={FrontendRoutes.ACTIVITY} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                                See all →
                            </Link>
                        </CardAction>
                    </CardHeader>
                    <CardContent className="p-0">
                        {teaserLoading ? (
                            <ActivityLoadingSkeleton />
                        ) : teaserRuns.length === 0 ? (
                            <div className="px-6 py-8 text-center">
                                <p className="text-sm text-muted-foreground">No activity yet.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {teaserRuns.map((run, i) => (
                                    <RunHistoryRow
                                        key={run.id}
                                        run={run}
                                        onOpenChat={() => openDrawer({ runs: teaserRuns, initialRunIndex: i })}
                                    />
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

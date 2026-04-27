import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { BarChart3, Clock } from "lucide-react"
import { DateTime } from "luxon"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import type { AgentActivityItem, CountByString, StatsInterval } from "terse-types/types"
import { type RunHistoryRecordWithAgent, RunHistoryStatus } from "terse-types/RunHistoryTypes"

import DateRangePicker from "@/components/RunHistory/DatePicker"
import RunHistoryEmptyState from "@/components/RunHistory/RunHistoryEmptyState"
import RunHistoryPagination from "@/components/RunHistory/RunHistoryPagination"
import { RunHistoryRow } from "@/components/RunHistory/RunHistoryRow"
import { SearchBar } from "@/components/RunHistory/SearchBar"
import StatusFilter from "@/components/RunHistory/StatusFilter"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllRunHistory } from "@/hooks/api/useAllRunHistory"
import { useStats } from "@/hooks/api/useStats"
import { cn } from "@/lib/utils"
import { useRunHistoryChatDrawer } from "@/services/RunHistoryChatDrawerContext"
import { formatNumber, getTrend } from "@/utility/timeUtils"

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
    "var(--chart-7)",
    "var(--chart-8)",
    "var(--chart-9)",
    "var(--chart-10)"
]

const STATS_INTERVAL_OPTIONS: Array<{ value: StatsInterval; label: string; longLabel: string }> = [
    { value: "1h", label: "1H", longLabel: "Last hour" },
    { value: "24h", label: "24H", longLabel: "Last 24 hours" },
    { value: "7d", label: "7D", longLabel: "Last 7 days" },
    { value: "1mo", label: "1M", longLabel: "Last month" },
    { value: "3mo", label: "3M", longLabel: "Last 3 months" },
    { value: "1y", label: "1Y", longLabel: "Last year" }
]

function formatTimezone(tz: string): string {
    const dt = DateTime.now().setZone(tz)
    return dt.isValid && dt.offsetNameLong ? dt.offsetNameLong : tz
}

function prettifyLabel(label: string): string {
    return label
        .replace(/_/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\b\w/g, c => c.toUpperCase())
}

function buildChartConfig(items: { label: string }[]): ChartConfig {
    const config: ChartConfig = {}
    items.forEach((item, i) => {
        config[item.label] = {
            label: prettifyLabel(item.label),
            color: CHART_COLORS[i % CHART_COLORS.length]
        }
    })
    return config
}

// ---------------------------------------------------------------------------
// Activity sub-components
// ---------------------------------------------------------------------------

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
// Stats sub-components
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

function StatsIntervalSelector({ selectedInterval, onSelectInterval }: { selectedInterval: StatsInterval; onSelectInterval: (interval: StatsInterval) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-1">
            {STATS_INTERVAL_OPTIONS.map(interval => {
                const isSelected = interval.value === selectedInterval
                return (
                    <button
                        key={interval.value}
                        type="button"
                        onClick={() => onSelectInterval(interval.value)}
                        className={cn(
                            "h-9 px-3 rounded-md border text-sm transition-colors",
                            isSelected ? "border-primary/40 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                        aria-pressed={isSelected}
                        aria-label={interval.longLabel}
                        title={interval.longLabel}
                    >
                        {interval.label}
                    </button>
                )
            })}
        </div>
    )
}

function DailyEventsSection({ eventsPerDay, timezone }: { eventsPerDay: { date: string; events: number }[]; timezone?: string }) {
    const chartConfig: ChartConfig = {
        events: { label: "Events", color: "var(--chart-1)" }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Event Volume Over Time</CardTitle>
                {timezone && (
                    <CardDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Times shown in {formatTimezone(timezone)}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="-ml-6">
                {eventsPerDay.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full [&>div]:!w-full">
                        <AreaChart data={eventsPerDay} margin={{ left: 24, right: 24, top: 0, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                label={{
                                    value: "Time",
                                    position: "insideBottom",
                                    offset: -12,
                                    style: { fill: "var(--muted-foreground)", fontSize: 12 }
                                }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                label={{
                                    value: "Events",
                                    angle: -90,
                                    position: "insideLeft",
                                    style: { fill: "var(--muted-foreground)", fontSize: 12, textAnchor: "middle" }
                                }}
                            />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                            <Area type="monotone" dataKey="events" stroke="var(--color-events)" fill="var(--color-events)" fillOpacity={0.2} />
                        </AreaChart>
                    </ChartContainer>
                ) : (
                    <Empty className="h-[300px] border-0">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <BarChart3 className="text-primary" />
                            </EmptyMedia>
                            <EmptyTitle>No events yet</EmptyTitle>
                            <EmptyDescription>Event data will appear here once your agents start running</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </CardContent>
        </Card>
    )
}

function AgentLeaderboard({ agents }: { agents: AgentActivityItem[] }) {
    const navigate = useNavigate()

    if (agents.length === 0) return null

    const max = agents[0]?.runCount ?? 1

    return (
        <Card>
            <CardHeader>
                <CardTitle>Most Active Agents</CardTitle>
                <CardDescription>Top agents by run count this period</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {agents.map((agent, i) => {
                        const pct = max > 0 ? (agent.runCount / max) * 100 : 0
                        return (
                            <div key={agent.agentId} className="group">
                                <div className="flex items-center justify-between mb-1">
                                    <button
                                        onClick={() => navigate(buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: agent.agentId }))}
                                        className="text-sm font-medium text-foreground hover:underline underline-offset-4 transition-colors truncate max-w-[200px]"
                                    >
                                        {agent.agentName}
                                    </button>
                                    <span className="text-sm text-muted-foreground tabular-nums">{agent.runCount.toLocaleString()} runs</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length]
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}

function StatusBreakdownChart({ data }: { data: CountByString[] }) {
    if (data.length === 0) return null

    const chartConfig = buildChartConfig(data)

    const pieData = data.map((d, i) => ({
        name: prettifyLabel(d.label),
        value: d.count,
        fill: CHART_COLORS[i % CHART_COLORS.length]
    }))

    const total = data.reduce((sum, d) => sum + d.count, 0)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Run Status Breakdown</CardTitle>
                <CardDescription>{total.toLocaleString()} total runs this period</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ChartContainer config={chartConfig} className="h-[200px] w-[200px] flex-shrink-0">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                                {pieData.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.fill} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    <div className="flex-1 space-y-2 w-full">
                        {data.map((d, i) => (
                            <div key={d.label} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                    <span className="text-sm text-foreground">{prettifyLabel(d.label)}</span>
                                </div>
                                <span className="text-sm text-muted-foreground tabular-nums">{d.count.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function HorizontalBarSection({ title, description, data }: { title: string; description: string; data: CountByString[] }) {
    if (data.length === 0) return null

    const chartConfig = buildChartConfig(data)

    const barData = data.map((d, i) => ({
        name: prettifyLabel(d.label),
        count: d.count,
        fill: CHART_COLORS[i % CHART_COLORS.length]
    }))

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="-ml-4">
                <ChartContainer config={chartConfig} className="h-[250px] w-full [&>div]:!w-full">
                    <BarChart data={barData} layout="vertical" margin={{ left: 80, right: 24, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={80} tick={{ fontSize: 12 }} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {barData.map((entry, idx) => (
                                <Cell key={idx} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}

function StatsLoadingSkeleton() {
    return (
        <div className="space-y-6">
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
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-[300px] w-full rounded-lg" />
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-40" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[200px] w-full rounded-lg" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-5 w-40" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[200px] w-full rounded-lg" />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function HomePage() {
    // Activity state
    const [currentPage, setCurrentPage] = useState(1)
    const [runsPerPage, setRunsPerPage] = useState(20)
    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(
        new Set([RunHistoryStatus.SUCCESS, RunHistoryStatus.FAILED, RunHistoryStatus.CANCELLED, RunHistoryStatus.IN_PROGRESS, RunHistoryStatus.AWAITING_APPROVAL])
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined })

    const { runs, total, isLoading: activityLoading } = useAllRunHistory({
        page: currentPage,
        pageSize: runsPerPage,
        searchQuery,
        dateRange,
        selectedStatuses
    })
    const { openDrawer } = useRunHistoryChatDrawer()

    const totalPages = Math.ceil(total / runsPerPage) || 1

    const toggleStatus = (status: RunHistoryStatus) => {
        const next = new Set(selectedStatuses)
        if (next.has(status)) {
            next.delete(status)
        } else {
            next.add(status)
        }
        setSelectedStatuses(next)
        setCurrentPage(1)
    }

    const handleSearchChange = (value: string) => {
        setSearchQuery(value)
        setCurrentPage(1)
    }

    const handleRunsPerPageChange = (value: number) => {
        setRunsPerPage(value)
        setCurrentPage(1)
    }

    const handleOpenChat = (run: RunHistoryRecordWithAgent) => {
        openDrawer({
            runs: runs,
            initialRunIndex: runs.findIndex(r => r.id === run.id)
        })
    }

    const hasActiveFilters = !!searchQuery || !!dateRange.from || !!dateRange.to || selectedStatuses.size < Object.values(RunHistoryStatus).length
    const startIndex = (currentPage - 1) * runsPerPage

    // Stats state
    const [selectedInterval, setSelectedInterval] = useState<StatsInterval>("1mo")
    const { stats, isLoading: statsLoading } = useStats(selectedInterval)
    const dailyEvents = useMemo(() => stats?.dailyEvents ?? [], [stats])

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full px-6 py-8">
                {/* ── Activity Section ──────────────────────────────── */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-foreground tracking-tight">Activity</h1>
                    <p className="text-muted-foreground mt-1 text-sm">A complete record of activity across your agents.</p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} placeholder="Search by event or agent name..." className="w-full sm:max-w-sm" />
                        <div className="flex items-center gap-3 sm:ml-auto">
                            <DateRangePicker
                                dateRange={dateRange}
                                onDateRangeChange={next => {
                                    setDateRange(next)
                                    setCurrentPage(1)
                                }}
                            />
                            <StatusFilter selectedStatuses={selectedStatuses} onToggleStatus={toggleStatus} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{total === 0 ? "No events" : `Showing ${startIndex + 1}–${Math.min(startIndex + runsPerPage, total)} of ${total}`}</span>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Per page</span>
                                <Select value={String(runsPerPage)} onValueChange={v => handleRunsPerPageChange(Number(v))}>
                                    <SelectTrigger className="w-18 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <RunHistoryPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card overflow-hidden mb-6">
                    {activityLoading ? (
                        <ActivityLoadingSkeleton />
                    ) : runs.length === 0 ? (
                        <div className="py-12">
                            <RunHistoryEmptyState
                                hasActiveFilters={hasActiveFilters}
                                onClearAll={() => {
                                    setSearchQuery("")
                                    setDateRange({ from: undefined, to: undefined })
                                    setSelectedStatuses(
                                        new Set([
                                            RunHistoryStatus.SUCCESS,
                                            RunHistoryStatus.FAILED,
                                            RunHistoryStatus.CANCELLED,
                                            RunHistoryStatus.SKIPPED,
                                            RunHistoryStatus.IN_PROGRESS,
                                            RunHistoryStatus.AWAITING_APPROVAL
                                        ])
                                    )
                                    setCurrentPage(1)
                                }}
                            />
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {runs.map(run => (
                                <RunHistoryRow key={run.id} run={run} onOpenChat={handleOpenChat} />
                            ))}
                        </div>
                    )}
                </div>

                {runs.length > 0 && totalPages > 1 && (
                    <div className="flex justify-center mb-8">
                        <RunHistoryPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                    </div>
                )}

                {/* ── Stats Section ─────────────────────────────────── */}
                <div className="border-t border-border/60 pt-8 mt-4 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Stats</h2>
                        <div className="space-y-1">
                            <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Time Range</p>
                            <StatsIntervalSelector selectedInterval={selectedInterval} onSelectInterval={setSelectedInterval} />
                        </div>
                    </div>

                    {statsLoading || !stats ? (
                        <StatsLoadingSkeleton />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <StatCard label="Events Processed" value={formatNumber(stats.totalEventsProcessed)} change={stats.totalEventsProcessedChange} />
                                <StatCard label="Actions Taken" value={formatNumber(stats.actionsTaken)} change={stats.actionsTakenChange} />
                                <StatCard label="Active Agents" value={formatNumber(stats.numberOfAgents)} change={stats.numberOfAgentsChange} />
                            </div>

                            <DailyEventsSection eventsPerDay={dailyEvents} timezone={stats.timezone} />

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <AgentLeaderboard agents={stats.agentActivity ?? []} />
                                <StatusBreakdownChart data={stats.statusBreakdown ?? []} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <HorizontalBarSection title="Trigger Sources" description="Where your events originate from" data={stats.triggerIntegrations ?? []} />
                                <HorizontalBarSection title="Action Integrations" description="Where your agents take action" data={stats.actionIntegrations ?? []} />
                            </div>

                            {(stats.actionTypes?.length ?? 0) > 0 && (
                                <HorizontalBarSection title="Action Types" description="Types of actions your agents perform" data={stats.actionTypes ?? []} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

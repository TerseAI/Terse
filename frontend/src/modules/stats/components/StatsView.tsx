import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { BarChart3, Clock } from "lucide-react"
import { DateTime } from "luxon"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import type { AgentActivityItem, CountByString, StatsInterval } from "terse-types/types"

import { FetchErrorCard } from "@/components/FetchErrorCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useStats } from "@/modules/stats/api/useStats"
import { formatNumber, getTrend } from "@/utils/time"

// ---------------------------------------------------------------------------
// Palette
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimezone(tz: string): string {
    const dt = DateTime.now().setZone(tz)
    return dt.isValid && dt.offsetNameLong ? dt.offsetNameLong : tz
}

function prettifyLabel(label: string): string {
    // Convert snake_case / camelCase to Title Case
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
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, change }: { label: string; value: string; change: string }) {
    const trend = getTrend(change)
    return (
        <Card className="py-4 gap-2">
            <CardHeader className="pb-0">
                <CardDescription className="text-xs font-medium">{label}</CardDescription>
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
                    <Button
                        key={interval.value}
                        type="button"
                        onClick={() => onSelectInterval(interval.value)}
                        variant={isSelected ? "secondary" : "ghost"}
                        size="sm"
                        aria-pressed={isSelected}
                        aria-label={interval.longLabel}
                        title={interval.longLabel}
                    >
                        {interval.label}
                    </Button>
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
                            <EmptyDescription>Event data will appear here once your jobs start running</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </CardContent>
        </Card>
    )
}

function AgentLeaderboard({ agents }: { agents: AgentActivityItem[] }) {
    if (agents.length === 0) return null

    const max = agents[0]?.runCount ?? 1

    return (
        <Card>
            <CardHeader>
                <CardTitle>Most Active Jobs</CardTitle>
                <CardDescription>Top jobs by run count this period</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {agents.map((agent, i) => {
                        const pct = max > 0 ? (agent.runCount / max) * 100 : 0
                        return (
                            <div key={agent.agentId} className="group">
                                <div className="flex items-center justify-between mb-1">
                                    <Link
                                        to={buildRoute(FrontendRoutes.JOBS.BY_ID, { id: agent.agentId })}
                                        className="text-sm font-medium text-foreground hover:underline underline-offset-4 transition-colors truncate max-w-[200px]"
                                    >
                                        {agent.agentName}
                                    </Link>
                                    <span className="text-sm text-muted-foreground tabular-nums">{agent.runCount.toLocaleString()} runs</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-[width] duration-500 ease-out"
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

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function StatsOverviewSkeleton() {
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

function StatsOverview() {
    const [selectedInterval, setSelectedInterval] = useState<StatsInterval>("1mo")
    const { stats, isLoading, isError, mutate } = useStats(selectedInterval)

    const dailyEvents = useMemo(() => stats?.dailyEvents ?? [], [stats])

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Time range</p>
                <StatsIntervalSelector selectedInterval={selectedInterval} onSelectInterval={setSelectedInterval} />
            </div>

            {isError && !stats ? (
                <FetchErrorCard message="Couldn't load stats." onRetry={() => void mutate()} />
            ) : isLoading || !stats ? (
                <StatsOverviewSkeleton />
            ) : (
                <>
                    {/* ── Top-level KPIs ──────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard label="Events Processed" value={formatNumber(stats.totalEventsProcessed)} change={stats.totalEventsProcessedChange} />
                        <StatCard label="Actions Taken" value={formatNumber(stats.actionsTaken)} change={stats.actionsTakenChange} />
                        <StatCard label="Active Jobs" value={formatNumber(stats.numberOfAgents)} change={stats.numberOfAgentsChange} />
                    </div>

                    {/* ── Daily Events Chart ──────────────────────────── */}
                    <DailyEventsSection eventsPerDay={dailyEvents} timezone={stats.timezone} />

                    {/* ── Insights Row 1 ──────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <AgentLeaderboard agents={stats.agentActivity ?? []} />
                        <StatusBreakdownChart data={stats.statusBreakdown ?? []} />
                    </div>

                    {/* ── Insights Row 2 ──────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <HorizontalBarSection title="Trigger Sources" description="Where your events originate from" data={stats.triggerIntegrations ?? []} />
                        <HorizontalBarSection title="Action Integrations" description="Where your jobs take action" data={stats.actionIntegrations ?? []} />
                    </div>

                    {/* ── Action Types ────────────────────────────────── */}
                    {(stats.actionTypes?.length ?? 0) > 0 && <HorizontalBarSection title="Action Types" description="Types of actions your jobs perform" data={stats.actionTypes ?? []} />}
                </>
            )}
        </div>
    )
}

export default StatsOverview

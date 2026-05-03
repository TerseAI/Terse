import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import type { UsageBucket } from "terse-types"

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCredits } from "@/utility/billingFormat"

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
const fullDayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" })

const chartConfig = {
    credits: { label: "Credits used", color: "var(--chart-1)" }
} satisfies ChartConfig

type Row = {
    startTimestamp: number
    label: string
    credits: number
}

export function UsageChart({ buckets }: { buckets: UsageBucket[] | null }) {
    if (!buckets) return <UsageChartSkeleton />

    if (buckets.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No usage yet</EmptyTitle>
                </EmptyHeader>
            </Empty>
        )
    }

    const rows: Row[] = buckets
        .map(bucket => ({
            startTimestamp: bucket.startTimestamp,
            label: dayFormatter.format(new Date(bucket.startTimestamp)),
            credits: bucket.credits
        }))
        .sort((a, b) => a.startTimestamp - b.startTimestamp)

    const total = rows.reduce((sum, row) => sum + row.credits, 0)
    const dailyAverage = total / rows.length
    const peak = rows.reduce((best, row) => (row.credits > best.credits ? row : best), rows[0])

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 divide-x divide-border">
                <Stat label="Total credits" value={formatCredits(total)} />
                <Stat label="Daily average" value={formatCredits(dailyAverage)} />
                <Stat label="Busiest day" value={formatCredits(peak.credits)} hint={peak.credits > 0 ? dayFormatter.format(new Date(peak.startTimestamp)) : undefined} />
            </div>

            <ChartContainer config={chartConfig} className="aspect-auto h-44 w-full">
                <BarChart data={rows} margin={{ left: 0, right: 0, top: 4, bottom: 0 }} barCategoryGap={3}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={48} />
                    <YAxis hide domain={[0, "dataMax"]} />
                    <ChartTooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                        content={
                            <ChartTooltipContent
                                indicator="dot"
                                labelFormatter={(_, payload) => {
                                    const row = payload?.[0]?.payload as Row | undefined
                                    return row ? fullDayFormatter.format(new Date(row.startTimestamp)) : ""
                                }}
                            />
                        }
                    />
                    <Bar dataKey="credits" name="credits" fill="var(--color-credits)" radius={[3, 3, 0, 0]} />
                </BarChart>
            </ChartContainer>
        </div>
    )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="px-4 first:pl-0 last:pr-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
            {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
        </div>
    )
}

function UsageChartSkeleton() {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="Loading usage">
            <div className="grid grid-cols-3 divide-x divide-border">
                {[0, 1, 2].map(i => (
                    <div key={i} className="space-y-2 px-4 first:pl-0 last:pr-0">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-24" />
                    </div>
                ))}
            </div>
            <Skeleton className="h-44 w-full" />
        </div>
    )
}

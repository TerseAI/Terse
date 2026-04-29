import type { UsageBucket } from "terse-types"

import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCredits } from "@/utility/billingFormat"

const dayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })

function formatDay(timestamp: number) {
    return dayFormatter.format(new Date(timestamp))
}

export function UsageChart({ buckets }: { buckets: UsageBucket[] | null }) {
    if (!buckets) {
        return <div className="h-44 text-sm text-muted-foreground">Loading usage...</div>
    }

    if (buckets.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>No usage yet</EmptyTitle>
                </EmptyHeader>
            </Empty>
        )
    }

    const total = buckets.reduce((sum, bucket) => sum + bucket.credits, 0)
    const dailyAverage = total / buckets.length
    const peak = buckets.reduce((best, bucket) => (bucket.credits > best.credits ? bucket : best), buckets[0])
    const max = Math.max(...buckets.map(bucket => bucket.credits), 1)

    const labelStartIdx = 0
    const labelMidIdx = Math.floor(buckets.length / 2)
    const labelEndIdx = buckets.length - 1

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-3 divide-x divide-border">
                <Stat label="Total credits" value={formatCredits(total)} />
                <Stat label="Daily average" value={formatCredits(Math.round(dailyAverage))} />
                <Stat label="Busiest day" value={peak.credits > 0 ? `${formatCredits(peak.credits)}` : "—"} hint={peak.credits > 0 ? formatDay(peak.startTimestamp) : undefined} />
            </div>

            <div>
                <div className="flex h-36 items-end gap-1">
                    {buckets.map(bucket => {
                        const height = bucket.credits === 0 ? 4 : Math.max(6, (bucket.credits / max) * 100)
                        return (
                            <Tooltip key={bucket.startTimestamp} delayDuration={80}>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`${formatDay(bucket.startTimestamp)}: ${formatCredits(bucket.credits)} credits`}
                                        className="min-w-1 flex-1 rounded-t-sm bg-foreground/15 transition-colors hover:bg-foreground focus-visible:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                                        style={{ height: `${height}%` }}
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <div className="font-medium">{formatDay(bucket.startTimestamp)}</div>
                                    <div className="text-muted-foreground">{formatCredits(bucket.credits)} credits</div>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>{formatDay(buckets[labelStartIdx].startTimestamp)}</span>
                    {buckets.length > 4 && <span>{formatDay(buckets[labelMidIdx].startTimestamp)}</span>}
                    <span>{formatDay(buckets[labelEndIdx].startTimestamp)}</span>
                </div>
            </div>
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

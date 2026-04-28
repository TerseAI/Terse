import type { UsageBucket } from "terse-types"

export function UsageChart({ buckets }: { buckets: UsageBucket[] | null }) {
    if (!buckets) {
        return <div className="h-40 rounded-lg border bg-card p-5 text-sm text-muted-foreground">Loading usage...</div>
    }

    if (buckets.length === 0) {
        return <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">No metered usage in the last 30 days.</div>
    }

    const max = Math.max(...buckets.map(bucket => bucket.credits), 1)

    return (
        <div className="rounded-lg border bg-card p-5">
            <div className="flex h-36 items-end gap-1.5">
                {buckets.map(bucket => {
                    const height = Math.max(4, (bucket.credits / max) * 100)
                    return (
                        <div
                            key={bucket.startTimestamp}
                            title={`${new Date(bucket.startTimestamp).toLocaleDateString()}: ${bucket.credits.toLocaleString()} credits`}
                            className="min-w-1 flex-1 rounded-t-sm bg-primary/35 transition-colors hover:bg-primary"
                            style={{ height: `${height}%` }}
                        />
                    )
                })}
            </div>
        </div>
    )
}

import { Skeleton } from "@/components/ui/skeleton"
import { useRunHistoryChatDrawer } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"

import RunHistoryEmptyState from "./RunHistoryEmptyState"
import { RunHistoryRow, type RunHistoryRowRecord } from "./RunHistoryRow"

type Props = {
    runs: RunHistoryRowRecord[]
    isLoading: boolean
    hasActiveFilters: boolean
    onClearFilters: () => void
}

export default function RunHistoryList({ runs, isLoading, hasActiveFilters, onClearFilters }: Props) {
    const { openDrawer } = useRunHistoryChatDrawer()

    const handleOpenRun = (runId: string) => {
        const initialRunIndex = runs.findIndex(run => run.id === runId)
        if (initialRunIndex === -1) return
        openDrawer({ runs, initialRunIndex })
    }

    return (
        <div className="overflow-hidden rounded-lg border bg-card">
            {isLoading ? (
                <LoadingSkeleton />
            ) : runs.length === 0 ? (
                <div className="py-12">
                    <RunHistoryEmptyState hasActiveFilters={hasActiveFilters} onClearAll={onClearFilters} />
                </div>
            ) : (
                <div role="list" aria-label="Run history" className="divide-y divide-border/40">
                    {runs.map(run => (
                        <RunHistoryRow key={run.id} run={run} onOpenRun={handleOpenRun} />
                    ))}
                </div>
            )}
        </div>
    )
}

function LoadingSkeleton() {
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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useRunHistoryChatDrawer } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"

import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryPagination from "./RunHistoryPagination"
import { RunHistoryRow, type RunHistoryRowRecord } from "./RunHistoryRow"

type Props = {
    runs: RunHistoryRowRecord[]
    isLoading: boolean
    hasActiveFilters: boolean
    onClearFilters: () => void
    total: number
    currentPage: number
    totalPages: number
    runsPerPage: number
    onPageChange: (page: number) => void
    onRunsPerPageChange: (value: number) => void
}

const PAGE_SIZES = [10, 25, 50, 100]

export default function RunHistoryList({ runs, isLoading, hasActiveFilters, onClearFilters, total, currentPage, totalPages, runsPerPage, onPageChange, onRunsPerPageChange }: Props) {
    const { openDrawer } = useRunHistoryChatDrawer()

    const handleOpenRun = (runId: string) => {
        const initialRunIndex = runs.findIndex(run => run.id === runId)
        if (initialRunIndex === -1) return
        openDrawer({ runs, initialRunIndex })
    }

    const startIndex = (currentPage - 1) * runsPerPage
    const needsPaging = totalPages > 1 || total > runsPerPage

    return (
        <>
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

            {!isLoading && runs.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs tabular-nums">
                        {startIndex + 1}-{Math.min(startIndex + runsPerPage, total)} of {total}
                    </span>

                    {needsPaging ? (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">Per page</span>
                                <Select value={String(runsPerPage)} onValueChange={value => onRunsPerPageChange(Number(value))}>
                                    <SelectTrigger className="h-7 w-16 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAGE_SIZES.map(size => (
                                            <SelectItem key={size} value={String(size)}>
                                                {size}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <RunHistoryPagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
                        </div>
                    ) : null}
                </div>
            ) : null}
        </>
    )
}

function LoadingSkeleton() {
    return (
        <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-2.5">
                    <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
                    <Skeleton className="h-4 w-3/4 max-w-[280px]" />
                    <Skeleton className="ml-auto h-5 w-16 rounded-full hidden sm:block" />
                    <Skeleton className="h-3 w-12" />
                </div>
            ))}
        </div>
    )
}

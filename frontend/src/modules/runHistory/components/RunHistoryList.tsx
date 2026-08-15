import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useRunHistoryChatDrawer } from "@/modules/runHistory/context/RunHistoryChatDrawerContext"

import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryPagination from "./RunHistoryPagination"
import { RunHistoryRow, type RunHistoryRowRecord } from "./RunHistoryRow"
import { RUN_HISTORY_COLUMN } from "./runHistoryColumns"

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

export const PAGE_SIZES = [10, 20, 50, 100]

export default function RunHistoryList({ runs, isLoading, hasActiveFilters, onClearFilters, total, currentPage, totalPages, runsPerPage, onPageChange, onRunsPerPageChange }: Props) {
    const { openDrawer } = useRunHistoryChatDrawer()
    const showJobColumn = runs.some(run => run.agentName)

    const handleOpenRun = (runId: string) => {
        const initialRunIndex = runs.findIndex(run => run.id === runId)
        if (initialRunIndex === -1) return
        openDrawer({ runs, initialRunIndex })
    }

    // A caller's page size that isn't one of the presets would otherwise leave the select blank.
    const sizeOptions = PAGE_SIZES.includes(runsPerPage) ? PAGE_SIZES : [...PAGE_SIZES, runsPerPage].sort((a, b) => a - b)
    const startIndex = (currentPage - 1) * runsPerPage
    const needsPaging = totalPages > 1 || total > runsPerPage

    return (
        <>
            <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
                {isLoading ? (
                    <LoadingSkeleton />
                ) : runs.length === 0 ? (
                    <div className="py-12">
                        <RunHistoryEmptyState hasActiveFilters={hasActiveFilters} onClearAll={onClearFilters} />
                    </div>
                ) : (
                    <Table>
                        <RunHistoryTableHeader showJobColumn={showJobColumn} />
                        <TableBody>
                            {runs.map(run => (
                                <RunHistoryRow key={run.id} run={run} onOpenRun={handleOpenRun} showJobColumn={showJobColumn} />
                            ))}
                        </TableBody>
                    </Table>
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
                                        {sizeOptions.map(size => (
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

function RunHistoryTableHeader({ showJobColumn }: { showJobColumn: boolean }) {
    return (
        <TableHeader className="bg-muted/20">
            <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className={cn(RUN_HISTORY_COLUMN.event, "pl-4")}>Event</TableHead>
                {showJobColumn && <TableHead className={RUN_HISTORY_COLUMN.job}>Job</TableHead>}
                <TableHead className={RUN_HISTORY_COLUMN.type}>Type</TableHead>
                <TableHead className={RUN_HISTORY_COLUMN.triggeredBy}>Triggered by</TableHead>
                <TableHead className={RUN_HISTORY_COLUMN.actions}>Actions</TableHead>
                <TableHead className={RUN_HISTORY_COLUMN.status}>Status</TableHead>
                <TableHead className={RUN_HISTORY_COLUMN.time}>Time</TableHead>
                <TableHead className={cn(RUN_HISTORY_COLUMN.retrigger, "pr-2.5")}>
                    <span className="sr-only">Re-trigger</span>
                </TableHead>
            </TableRow>
        </TableHeader>
    )
}

function LoadingSkeleton() {
    return (
        <Table>
            <RunHistoryTableHeader showJobColumn={false} />
            <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i} className="border-border/40 hover:bg-transparent">
                        <TableCell className={cn(RUN_HISTORY_COLUMN.event, "py-2.5 pl-4")}>
                            <div className="flex items-center gap-2.5">
                                <Skeleton className="size-7 shrink-0 rounded-lg" />
                                <Skeleton className="h-4 w-40" />
                            </div>
                        </TableCell>
                        <TableCell className={RUN_HISTORY_COLUMN.type}>
                            <Skeleton className="h-4 w-14 rounded-full" />
                        </TableCell>
                        <TableCell className={RUN_HISTORY_COLUMN.triggeredBy}>
                            <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className={RUN_HISTORY_COLUMN.actions}>
                            <Skeleton className="ml-auto h-3 w-6" />
                        </TableCell>
                        <TableCell className={RUN_HISTORY_COLUMN.status}>
                            <Skeleton className="h-5 w-20 rounded-full" />
                        </TableCell>
                        <TableCell className={RUN_HISTORY_COLUMN.time}>
                            <Skeleton className="ml-auto h-3 w-16" />
                        </TableCell>
                        <TableCell className={cn(RUN_HISTORY_COLUMN.retrigger, "pr-2.5")}>
                            <Skeleton className="size-7 rounded-md" />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

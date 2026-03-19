import { useState } from "react"

import DateRangePicker from "@/components/RunHistory/DatePicker"
import RunHistoryEmptyState from "@/components/RunHistory/RunHistoryEmptyState"
import RunHistoryPagination from "@/components/RunHistory/RunHistoryPagination"
import { RunHistoryRow } from "@/components/RunHistory/RunHistoryRow"
import { SearchBar } from "@/components/RunHistory/SearchBar"
import StatusFilter from "@/components/RunHistory/StatusFilter"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllRunHistory } from "@/hooks/api/useAllRunHistory"
import { type RunHistoryRecordWithAgent, RunHistoryStatus } from "@/shared/RunHistoryTypes"

import { useRunHistoryChatDrawer } from "../../services/RunHistoryChatDrawerContext"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ActivityPage() {
    const [currentPage, setCurrentPage] = useState(1)
    const [runsPerPage, setRunsPerPage] = useState(20)
    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(
        new Set([RunHistoryStatus.SUCCESS, RunHistoryStatus.FAILED, RunHistoryStatus.CANCELLED, RunHistoryStatus.IN_PROGRESS, RunHistoryStatus.AWAITING_APPROVAL])
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined })

    const { runs, total, isLoading } = useAllRunHistory({
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

    return (
        <div className="mx-auto w-full px-6 py-8">
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Activity</h1>
                <p className="text-muted-foreground mt-1 text-sm">A complete record of activity across your agents.</p>
            </div>

            {/* ── Toolbar ─────────────────────────────────────────── */}
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

            {/* ── Content ─────────────────────────────────────────── */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                {isLoading ? (
                    <LoadingSkeleton />
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

            {/* ── Bottom pagination ───────────────────────────────── */}
            {runs.length > 0 && totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <RunHistoryPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
            )}
        </div>
    )
}

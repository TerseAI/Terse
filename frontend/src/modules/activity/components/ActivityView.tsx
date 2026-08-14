import { useState } from "react"

import { RunHistoryStatus } from "terse-types/RunHistoryTypes"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAllRunHistory } from "@/modules/runHistory/api/useAllRunHistory"
import DateRangePicker from "@/modules/runHistory/components/DatePicker"
import RunHistoryList from "@/modules/runHistory/components/RunHistoryList"
import RunHistoryPagination from "@/modules/runHistory/components/RunHistoryPagination"
import { SearchBar } from "@/modules/runHistory/components/SearchBar"
import StatusFilter from "@/modules/runHistory/components/StatusFilter"

const DEFAULT_STATUSES: readonly RunHistoryStatus[] = Object.values(RunHistoryStatus)

export default function ActivityPage() {
    const [currentPage, setCurrentPage] = useState(1)
    const [runsPerPage, setRunsPerPage] = useState(20)
    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(new Set(DEFAULT_STATUSES))
    const [searchQuery, setSearchQuery] = useState("")
    const [includeTest, setIncludeTest] = useState(false)
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined })

    const { runs, total, isLoading } = useAllRunHistory({
        page: currentPage,
        pageSize: runsPerPage,
        searchQuery,
        dateRange,
        selectedStatuses,
        includeTest
    })
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

    const toggleIncludeTest = () => {
        setIncludeTest(prev => !prev)
        setCurrentPage(1)
    }

    const handleRunsPerPageChange = (value: number) => {
        setRunsPerPage(value)
        setCurrentPage(1)
    }

    const clearFilters = () => {
        setSearchQuery("")
        setDateRange({ from: undefined, to: undefined })
        setSelectedStatuses(new Set(DEFAULT_STATUSES))
        setCurrentPage(1)
    }

    const hasActiveFilters = !!searchQuery || !!dateRange.from || !!dateRange.to || selectedStatuses.size < DEFAULT_STATUSES.length || includeTest

    const startIndex = (currentPage - 1) * runsPerPage

    return (
        <div className="mx-auto w-full px-6 py-8">
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Activity</h1>
                <p className="text-muted-foreground mt-1 text-sm">A complete record of activity across your jobs.</p>
            </div>

            {/* ── Toolbar ─────────────────────────────────────────── */}
            <div className="space-y-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} placeholder="Search by event or job name…" className="w-full sm:max-w-sm" />

                    <div className="flex items-center gap-3 sm:ml-auto">
                        <DateRangePicker
                            dateRange={dateRange}
                            onDateRangeChange={next => {
                                setDateRange(next)
                                setCurrentPage(1)
                            }}
                        />
                        <StatusFilter selectedStatuses={selectedStatuses} onToggleStatus={toggleStatus} includeTest={includeTest} onToggleIncludeTest={toggleIncludeTest} />
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
            <RunHistoryList runs={runs} isLoading={isLoading} hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />

            {/* ── Bottom pagination ───────────────────────────────── */}
            {runs.length > 0 && totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <RunHistoryPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
            )}
        </div>
    )
}

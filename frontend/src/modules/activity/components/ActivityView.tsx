import { useState } from "react"
import { useSearchParams } from "react-router-dom"

import { RunHistoryStatus } from "terse-types/RunHistoryTypes"

import { PageFrame } from "@/components/PageFrame"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ACTIVITY_OVERVIEW_VIEW, ACTIVITY_VIEW_PARAM } from "@/modules/activity/activityRoutes"
import { useAllRunHistory } from "@/modules/runHistory/api/useAllRunHistory"
import DateRangePicker from "@/modules/runHistory/components/DatePicker"
import RunHistoryList from "@/modules/runHistory/components/RunHistoryList"
import { SearchBar } from "@/modules/runHistory/components/SearchBar"
import StatusFilter from "@/modules/runHistory/components/StatusFilter"
import StatsOverview from "@/modules/stats/components/StatsView"

const DEFAULT_STATUSES: readonly RunHistoryStatus[] = Object.values(RunHistoryStatus)

type ActivityTab = "runs" | typeof ACTIVITY_OVERVIEW_VIEW

export default function ActivityPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const activeTab: ActivityTab = searchParams.get(ACTIVITY_VIEW_PARAM) === ACTIVITY_OVERVIEW_VIEW ? ACTIVITY_OVERVIEW_VIEW : "runs"

    const selectTab = (next: string) => {
        if (next === ACTIVITY_OVERVIEW_VIEW) {
            setSearchParams({ [ACTIVITY_VIEW_PARAM]: ACTIVITY_OVERVIEW_VIEW }, { replace: true })
        } else {
            setSearchParams({}, { replace: true })
        }
    }

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
        includeTest,
        enabled: activeTab === "runs"
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

    return (
        <PageFrame>
            <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Activity</h1>

            <Tabs value={activeTab} onValueChange={selectTab}>
                <TabsList variant="line" className="mb-6 justify-start gap-6">
                    <TabsTrigger variant="line" value="runs" className="flex-none px-0 after:inset-x-0">
                        Runs
                    </TabsTrigger>
                    <TabsTrigger variant="line" value={ACTIVITY_OVERVIEW_VIEW} className="flex-none px-0 after:inset-x-0">
                        Overview
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="runs" className="mt-0">
                    {/* ── Toolbar ─────────────────────────────────────────── */}
                    <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-3">
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

                    <RunHistoryList
                        runs={runs}
                        isLoading={isLoading}
                        hasActiveFilters={hasActiveFilters}
                        onClearFilters={clearFilters}
                        total={total}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        runsPerPage={runsPerPage}
                        onPageChange={setCurrentPage}
                        onRunsPerPageChange={handleRunsPerPageChange}
                    />
                </TabsContent>

                <TabsContent value="overview" className="mt-0">
                    <StatsOverview />
                </TabsContent>
            </Tabs>
        </PageFrame>
    )
}

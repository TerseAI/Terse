import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { useRunHistory } from "../../hooks/api/useRunHistory"
import { useRunHistoryChatDrawer } from "../../services/RunHistoryChatDrawerContext"
import { RunHistoryRecord, RunHistoryStatus } from "../../shared/RunHistoryTypes"

import RunHistoryChatDrawer from "./RunHistoryChatDrawer"
import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryItem from "./RunHistoryItem"
import RunHistoryLoadingState from "./RunHistoryLoadingState"
import RunHistoryToolBar from "./RunHistoryToolBar"

// Remote data source only; no local mock

type RunHistoryProps = {
    agentId: string | null
    onTriggerNow?: () => void
}

export default function RunHistory({ agentId, onTriggerNow }: RunHistoryProps) {
    const [searchParams, setSearchParams] = useSearchParams()
    const [currentPage, setCurrentPage] = useState(1)
    const [runsPerPage, setRunsPerPage] = useState(10)
    const { openDrawer, closeDrawer } = useRunHistoryChatDrawer()

    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(
        new Set([RunHistoryStatus.SUCCESS, RunHistoryStatus.FAILED, RunHistoryStatus.IN_PROGRESS, RunHistoryStatus.AWAITING_APPROVAL])
    )
    const [searchQuery, setSearchQuery] = useState("")
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    })

    // Get runId from URL params for deep linking
    const urlRunId = searchParams.get("runId")
    const [openDrawerRunId, setOpenDrawerRunId] = useState<string | null>(urlRunId || null)

    // Keep a reference to the currently viewed run so it doesn't disappear if filtered out
    const pinnedRunRef = useRef<RunHistoryRecord | null>(null)

    const {
        runs: remoteRuns,
        total,
        isLoading
    } = useRunHistory({
        agentId,
        page: currentPage,
        pageSize: runsPerPage,
        searchQuery,
        dateRange,
        selectedStatuses
    })

    // Handle URL parameter changes for deep linking
    useEffect(() => {
        const urlRunId = searchParams.get("runId")
        if (urlRunId && urlRunId !== openDrawerRunId) {
            const wasClosed = openDrawerRunId === null
            setOpenDrawerRunId(urlRunId)
            openDrawer({
                runs: paginatedRuns,
                currentRunIndex: currentDrawerRunIndex ?? 0,
                onNavigate: newRunId => {
                    if (openDrawerRunId === newRunId) {
                        return
                    }
                }
            })
            if (wasClosed) {
            }
        } else if (!urlRunId && openDrawerRunId) {
            // If URL param is removed but drawer is still open, close it
            setOpenDrawerRunId(null)
        }
    }, [searchParams, openDrawerRunId])

    // Update the pinned run reference when we have a new run with the open drawer ID
    useEffect(() => {
        if (openDrawerRunId) {
            const currentRun = remoteRuns.find(r => r.id === openDrawerRunId)
            if (currentRun) {
                // Update the pinned run with fresh data
                pinnedRunRef.current = currentRun
            }
        } else {
            // Clear the pinned run when drawer is closed
            pinnedRunRef.current = null
        }
    }, [openDrawerRunId, remoteRuns])

    // Include the pinned run in the list if it's not already there
    const filteredRuns = useMemo(() => {
        if (!openDrawerRunId || !pinnedRunRef.current) {
            return remoteRuns
        }

        const pinnedRun = pinnedRunRef.current
        const isInList = remoteRuns.some(r => r.id === pinnedRun.id)

        if (isInList) {
            return remoteRuns
        }

        // Pinned run is not in the list (was filtered out), add it back at the appropriate position
        // Insert based on timestamp to maintain order
        const runsWithPinned = [...remoteRuns]
        const pinnedTimestamp = new Date(pinnedRun.timestamp).getTime()

        // Find the right position (runs are typically sorted by timestamp desc)
        let insertIndex = runsWithPinned.findIndex(r => new Date(r.timestamp).getTime() < pinnedTimestamp)

        if (insertIndex === -1) {
            // Pinned run is oldest, add at the end
            runsWithPinned.push(pinnedRun)
        } else {
            runsWithPinned.splice(insertIndex, 0, pinnedRun)
        }

        return runsWithPinned
    }, [remoteRuns, openDrawerRunId])

    const totalPages = Math.ceil(total / runsPerPage) || 1
    const startIndex = (currentPage - 1) * runsPerPage
    const paginatedRuns = filteredRuns // server provides paginated items already
    const currentDrawerRunIndex = useMemo(() => {
        if (!openDrawerRunId) {
            return undefined
        }
        const index = paginatedRuns.findIndex(run => run.id === openDrawerRunId)
        return index >= 0 ? index : undefined
    }, [openDrawerRunId, paginatedRuns])
    const toggleStatus = (status: RunHistoryStatus) => {
        const next = new Set(selectedStatuses)
        next.has(status) ? next.delete(status) : next.add(status)
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

    return (
        <div className="h-full w-full px-3 py-4">
            <div className="w-full max-w-7xl">
                <RunHistoryToolBar
                    filteredCount={total}
                    startIndex={startIndex}
                    runsPerPage={runsPerPage}
                    searchQuery={searchQuery}
                    onSearchChange={handleSearchChange}
                    dateRange={dateRange}
                    onDateRangeChange={next => {
                        setDateRange(next)
                        setCurrentPage(1)
                    }}
                    selectedStatuses={selectedStatuses}
                    onToggleStatus={toggleStatus}
                    runsPerPageValue={runsPerPage}
                    onRunsPerPageChange={handleRunsPerPageChange}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    onTriggerNow={onTriggerNow}
                />

                {isLoading ? (
                    <RunHistoryLoadingState />
                ) : filteredRuns.length === 0 ? (
                    <RunHistoryEmptyState
                        hasActiveFilters={!!searchQuery || !!dateRange.from || !!dateRange.to || selectedStatuses.size < Object.values(RunHistoryStatus).length}
                        onClearAll={() => {
                            setSearchQuery("")
                            setDateRange({ from: undefined, to: undefined })
                            setSelectedStatuses(
                                new Set([RunHistoryStatus.SUCCESS, RunHistoryStatus.FAILED, RunHistoryStatus.SKIPPED, RunHistoryStatus.IN_PROGRESS, RunHistoryStatus.AWAITING_APPROVAL])
                            )
                            setCurrentPage(1)
                        }}
                    />
                ) : (
                    <div className="mb-6">
                        <div className="flex flex-col gap-3 overflow-x-auto pb-3 md:overflow-visible md:pb-0 max-w-full">
                            {paginatedRuns.map(run => (
                                <RunHistoryItem
                                    key={run.id}
                                    run={run}
                                    onViewChat={runId => {
                                        if (openDrawerRunId === runId) {
                                            return
                                        }
                                        setOpenDrawerRunId(runId)
                                        // Update URL to include runId for deep linking
                                        const nextParams = new URLSearchParams(searchParams)
                                        nextParams.set("runId", runId)
                                        setSearchParams(nextParams, { replace: true })
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

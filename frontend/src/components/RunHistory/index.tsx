import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryToolBar from "./RunHistoryToolBar";
import RunHistoryItem from "./RunHistoryItem";
import RunHistoryLoadingState from "./RunHistoryLoadingState";
import { RunHistoryStatus, RunHistoryRecord } from "../../shared/RunHistoryTypes";
import { useRunHistory } from "../../hooks/api/useRunHistory";

// Remote data source only; no local mock

type RunHistoryProps = {
    channelId: string | null;
};

export default function RunHistory({ channelId }: RunHistoryProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [currentPage, setCurrentPage] = useState(1);
    const [runsPerPage, setRunsPerPage] = useState(10);

    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(
        new Set(["success", "failed", "in_progress", "awaiting_approval"])
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });
    
    // Get runId and prompt from URL params for deep linking
    const urlRunId = searchParams.get('runId');
    const urlPrompt = searchParams.get('prompt');
    const [openDrawerRunId, setOpenDrawerRunId] = useState<string | null>(urlRunId || null);
    const [isDrawerFullscreen, setIsDrawerFullscreen] = useState(false); // Keep drawer partially open when opened via deep link (e.g., from Slack)
    const [isInitialDrawerOpen, setIsInitialDrawerOpen] = useState(!!urlRunId);
    
    // Keep a reference to the currently viewed run so it doesn't disappear if filtered out
    const pinnedRunRef = useRef<RunHistoryRecord | null>(null);

    const { runs: remoteRuns, total, isLoading } = useRunHistory({
        channelId,
        page: currentPage,
        pageSize: runsPerPage,
        searchQuery,
        dateRange,
        selectedStatuses,
    });

    // Handle URL parameter changes for deep linking
    useEffect(() => {
        const urlRunId = searchParams.get('runId');
        if (urlRunId && urlRunId !== openDrawerRunId) {
            setOpenDrawerRunId(urlRunId);
            setIsInitialDrawerOpen(true);
            setIsDrawerFullscreen(false); // Keep drawer partially open when opened via deep link (e.g., from Slack)
        } else if (!urlRunId && openDrawerRunId) {
            // If URL param is removed but drawer is still open, close it
            setOpenDrawerRunId(null);
            setIsDrawerFullscreen(false);
        }
    }, [searchParams, openDrawerRunId]);

    // Update the pinned run reference when we have a new run with the open drawer ID
    useEffect(() => {
        if (openDrawerRunId) {
            const currentRun = remoteRuns.find(r => r.id === openDrawerRunId);
            if (currentRun) {
                // Update the pinned run with fresh data
                pinnedRunRef.current = currentRun;
            }
        } else {
            // Clear the pinned run when drawer is closed
            pinnedRunRef.current = null;
        }
    }, [openDrawerRunId, remoteRuns]);

    // Include the pinned run in the list if it's not already there
    const filteredRuns = useMemo(() => {
        if (!openDrawerRunId || !pinnedRunRef.current) {
            return remoteRuns;
        }
        
        const pinnedRun = pinnedRunRef.current;
        const isInList = remoteRuns.some(r => r.id === pinnedRun.id);
        
        if (isInList) {
            return remoteRuns;
        }
        
        // Pinned run is not in the list (was filtered out), add it back at the appropriate position
        // Insert based on timestamp to maintain order
        const runsWithPinned = [...remoteRuns];
        const pinnedTimestamp = new Date(pinnedRun.timestamp).getTime();
        
        // Find the right position (runs are typically sorted by timestamp desc)
        let insertIndex = runsWithPinned.findIndex(r => 
            new Date(r.timestamp).getTime() < pinnedTimestamp
        );
        
        if (insertIndex === -1) {
            // Pinned run is oldest, add at the end
            runsWithPinned.push(pinnedRun);
        } else {
            runsWithPinned.splice(insertIndex, 0, pinnedRun);
        }
        
        return runsWithPinned;
    }, [remoteRuns, openDrawerRunId]);

    const totalPages = Math.ceil(total / runsPerPage) || 1;
    const startIndex = (currentPage - 1) * runsPerPage;
    const paginatedRuns = filteredRuns; // server provides paginated items already

    const toggleStatus = (status: RunHistoryStatus) => {
        const next = new Set(selectedStatuses);
        next.has(status) ? next.delete(status) : next.add(status);
        setSelectedStatuses(next);
        setCurrentPage(1);
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };

    const handleRunsPerPageChange = (value: number) => {
        setRunsPerPage(value);
        setCurrentPage(1);
    };

    return (
        <div className="w-full px-3 py-4 h-full">
            <RunHistoryToolBar
                filteredCount={total}
                startIndex={startIndex}
                runsPerPage={runsPerPage}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                dateRange={dateRange}
                onDateRangeChange={(next) => { setDateRange(next); setCurrentPage(1); }}
                selectedStatuses={selectedStatuses}
                onToggleStatus={toggleStatus}
                runsPerPageValue={runsPerPage}
                onRunsPerPageChange={handleRunsPerPageChange}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

            {isLoading ? (
                <RunHistoryLoadingState />
            ) : filteredRuns.length === 0 ? (
                <RunHistoryEmptyState
                    hasActiveFilters={!!searchQuery || !!dateRange.from || !!dateRange.to || selectedStatuses.size < 5}
                    onClearAll={() => {
                        setSearchQuery("");
                        setDateRange({ from: undefined, to: undefined });
                        setSelectedStatuses(new Set(["success", "failed", "skipped", "in_progress", "awaiting_approval"]));
                        setCurrentPage(1);
                    }}
                />
            ) : (
                <div className="mb-6">
                    <div className="flex flex-col gap-3 overflow-x-auto md:overflow-visible pb-3 md:pb-0 max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto">
                        {paginatedRuns.map((run, index) => (
                            <RunHistoryItem
                                key={run.id}
                                run={run}
                                runs={paginatedRuns}
                                currentRunIndex={index}
                                isDrawerOpen={openDrawerRunId === run.id}
                                initialPrompt={openDrawerRunId === run.id && urlPrompt ? decodeURIComponent(urlPrompt) : undefined}
                                onDrawerOpenChange={(open) => {
                                    if (open) {
                                        setIsInitialDrawerOpen(true);
                                        setOpenDrawerRunId(run.id);
                                        // Update URL to include runId for deep linking
                                        const nextParams = new URLSearchParams(searchParams);
                                        nextParams.set('runId', run.id);
                                        setSearchParams(nextParams, { replace: true });
                                    } else {
                                        setOpenDrawerRunId(null);
                                        setIsDrawerFullscreen(false);
                                        // Remove runId and prompt from URL when drawer closes
                                        const nextParams = new URLSearchParams(searchParams);
                                        nextParams.delete('runId');
                                        nextParams.delete('prompt');
                                        setSearchParams(nextParams, { replace: true });
                                    }
                                }}
                                onNavigateToRun={(newRunId) => {
                                    setOpenDrawerRunId(newRunId);
                                    setIsInitialDrawerOpen(false);
                                    // Update URL when navigating to a different run, preserve prompt if present
                                    const nextParams = new URLSearchParams(searchParams);
                                    nextParams.set('runId', newRunId);
                                    setSearchParams(nextParams, { replace: true });
                                }}
                                isFullscreen={isDrawerFullscreen}
                                onFullscreenChange={setIsDrawerFullscreen}
                                isInitialOpen={isInitialDrawerOpen}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}



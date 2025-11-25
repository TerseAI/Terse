import { useMemo, useState } from "react";
import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryToolBar from "./RunHistoryToolBar";
import RunHistoryItem from "./RunHistoryItem";
import RunHistoryLoadingState from "./RunHistoryLoadingState";
import { RunHistoryStatus } from "../../shared/RunHistoryTypes";
import { useRunHistory } from "../../hooks/api/useRunHistory";

// Remote data source only; no local mock

type RunHistoryProps = {
    channelId: string | null;
};

export default function RunHistory({ channelId }: RunHistoryProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const [runsPerPage, setRunsPerPage] = useState(10);

    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(
        new Set(["success", "failed", "in_progress"])
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });
    const [openDrawerRunId, setOpenDrawerRunId] = useState<string | null>(null);
    const [isDrawerFullscreen, setIsDrawerFullscreen] = useState(false);
    const [isInitialDrawerOpen, setIsInitialDrawerOpen] = useState(true);

    const { runs: remoteRuns, total, isLoading } = useRunHistory({
        channelId,
        page: currentPage,
        pageSize: runsPerPage,
        searchQuery,
        dateRange,
        selectedStatuses,
    });

    const filteredRuns = useMemo(() => remoteRuns, [remoteRuns]);

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
                    hasActiveFilters={!!searchQuery || !!dateRange.from || !!dateRange.to || selectedStatuses.size < 4}
                    onClearAll={() => {
                        setSearchQuery("");
                        setDateRange({ from: undefined, to: undefined });
                        setSelectedStatuses(new Set(["success", "failed", "skipped", "in_progress"]));
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
                                onDrawerOpenChange={(open) => {
                                    if (open) {
                                        setIsInitialDrawerOpen(true);
                                        setOpenDrawerRunId(run.id);
                                    } else {
                                        setOpenDrawerRunId(null);
                                        setIsDrawerFullscreen(false);
                                    }
                                }}
                                onNavigateToRun={(newRunId) => {
                                    setOpenDrawerRunId(newRunId);
                                    setIsInitialDrawerOpen(false);
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



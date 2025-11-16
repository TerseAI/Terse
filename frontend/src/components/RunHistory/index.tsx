import { useMemo, useState } from "react";
import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryToolBar from "./RunHistoryToolBar";
import RunHistoryItem from "./RunHistoryItem";
import RunHistoryLoadingState from "./RunHistoryLoadingState";
import { RunHistoryStatus } from "../../shared/RunHistoryTypes";
import { useRunHistory } from "../../hooks/api/useRunHistory";
import { useAutomationVersions } from "../../hooks/api/useAutomations";

// Remote data source only; no local mock

type RunHistoryProps = {
    automationId: string | null;
};

export default function RunHistory({ automationId }: RunHistoryProps) {
    const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
    const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());
    const [expandedIndividualActions, setExpandedIndividualActions] = useState<Set<string>>(new Set());

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

    const { runs: remoteRuns, total, isLoading } = useRunHistory({
        automationId,
        page: currentPage,
        pageSize: runsPerPage,
        searchQuery,
        dateRange,
        selectedStatuses,
    });

    // Fetch versions to create version number map
    const { versions } = useAutomationVersions(automationId);
    
    // Create a map of versionId -> versionNumber
    const versionNumberMap = useMemo(() => {
        const map = new Map<string, number>();
        const productionVersions = versions
            .filter(v => v.status === 'PRODUCTION')
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Sort by creation date (oldest first)
        
        productionVersions.forEach((version, index) => {
            map.set(version.id, index + 1); // Version numbers start at 1
        });
        
        return map;
    }, [versions]);

    const filteredRuns = useMemo(() => remoteRuns, [remoteRuns]);

    const totalPages = Math.ceil(total / runsPerPage) || 1;
    const startIndex = (currentPage - 1) * runsPerPage;
    const paginatedRuns = filteredRuns; // server provides paginated items already

    const toggleRun = (runId: string) => {
        const next = new Set(expandedRuns);
        next.has(runId) ? next.delete(runId) : next.add(runId);
        setExpandedRuns(next);
    };

    const toggleDecision = (runId: string) => {
        const next = new Set(expandedDecisions);
        next.has(runId) ? next.delete(runId) : next.add(runId);
        setExpandedDecisions(next);
    };

    const toggleIndividualAction = (actionKey: string) => {
        const next = new Set(expandedIndividualActions);
        next.has(actionKey) ? next.delete(actionKey) : next.add(actionKey);
        setExpandedIndividualActions(next);
    };

    const toggleAllActionsForRun = (runId: string, actionCount: number) => {
        const next = new Set(expandedIndividualActions);
        const keys = Array.from({ length: actionCount }, (_, i) => `${runId}-action-${i}`);
        const allExpanded = keys.every((k) => next.has(k));
        if (allExpanded) keys.forEach((k) => next.delete(k));
        else keys.forEach((k) => next.add(k));
        setExpandedIndividualActions(next);
    };

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
                        {paginatedRuns.map((run) => {
                            const versionNumber = run.automationVersionId 
                                ? versionNumberMap.get(run.automationVersionId) 
                                : undefined;
                            return (
                                <RunHistoryItem
                                    key={run.id}
                                    run={run}
                                    versionNumber={versionNumber}
                                    isExpanded={expandedRuns.has(run.id)}
                                    onToggleRun={toggleRun}
                                    isDecisionExpanded={expandedDecisions.has(run.id)}
                                    onToggleDecision={toggleDecision}
                                    isActionExpanded={(key) => expandedIndividualActions.has(key)}
                                    onToggleAction={toggleIndividualAction}
                                    onToggleAllActionsForRun={toggleAllActionsForRun}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}



import { useEffect, useMemo, useState } from "react";
import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryToolBar from "./RunHistoryToolBar";
import RunHistoryItem from "./RunHistoryItem";
import { RunHistoryRecord, RunHistoryStatus } from "../../shared/RunHistoryTypes";
import { useAutomationContext } from "../../context/AutomationContext";
import { BackendProvider } from "../../services/backend";

// Remote data source only; no local mock

export default function RunHistory() {
    const { automationId } = useAutomationContext();
    const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
    const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());
    const [expandedIndividualActions, setExpandedIndividualActions] = useState<Set<string>>(new Set());

    const [currentPage, setCurrentPage] = useState(1);
    const [runsPerPage, setRunsPerPage] = useState(10);
    const [total, setTotal] = useState(0);
    const [remoteRuns, setRemoteRuns] = useState<RunHistoryRecord[]>([]);

    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(
        new Set(["success", "failed", "skipped", "in_progress"])
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    useEffect(() => {
        const controller = new AbortController();
        const toLocalStartISOString = (d?: Date) => {
            if (!d) return undefined;
            const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
            return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
        };
        const toLocalEndISOString = (d?: Date) => {
            if (!d) return undefined;
            const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            return new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString();
        };
        const run = async () => {
            if (!automationId) return;
            const params = {
                page: currentPage,
                pageSize: runsPerPage,
                q: searchQuery.trim() || undefined,
                start: toLocalStartISOString(dateRange.from),
                end: toLocalEndISOString(dateRange.to ?? dateRange.from),
                status: Array.from(selectedStatuses).length < 4 ? Array.from(selectedStatuses) : undefined,
            } as any;
            try {
                const data = await BackendProvider.getRunHistory(automationId, params);
                if (!controller.signal.aborted) {
                    setRemoteRuns(data.items);
                    setTotal(data.total);
                }
            } catch (e) {
                if (!controller.signal.aborted) {
                    console.error('Failed to fetch run history', e);
                }
            }
        };
        run();
        return () => controller.abort();
    }, [automationId, currentPage, runsPerPage, searchQuery, dateRange.from, dateRange.to, selectedStatuses]);

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
        <div className="max-w-5xl mx-auto px-6 py-4 h-full">
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

            {filteredRuns.length === 0 && (
                <RunHistoryEmptyState
                    hasActiveFilters={!!searchQuery || !!dateRange.from || !!dateRange.to || selectedStatuses.size < 4}
                    onClearAll={() => {
                        setSearchQuery("");
                        setDateRange({ from: undefined, to: undefined });
                        setSelectedStatuses(new Set(["success", "failed", "skipped", "in_progress"]));
                        setCurrentPage(1);
                    }}
                />
            )}

            <div className="mb-6">
                <div className="flex flex-col gap-3 overflow-x-auto md:overflow-visible pb-3 md:pb-0">
                    {paginatedRuns.map((run) => (
                        <RunHistoryItem
                            key={run.id}
                            run={run}
                            isExpanded={expandedRuns.has(run.id)}
                            onToggleRun={toggleRun}
                            isDecisionExpanded={expandedDecisions.has(run.id)}
                            onToggleDecision={toggleDecision}
                            isActionExpanded={(key) => expandedIndividualActions.has(key)}
                            onToggleAction={toggleIndividualAction}
                            onToggleAllActionsForRun={toggleAllActionsForRun}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}



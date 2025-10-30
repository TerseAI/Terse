import { useMemo, useState } from "react";
import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryToolBar from "./RunHistoryToolBar";
import RunHistoryItem from "./RunHistoryItem";
import { RunHistoryRecord, RunHistoryStatus } from "../../shared/RunHistoryTypes";

const mockRunHistory: RunHistoryRecord[] = [
    {
        id: "run-001",
        automationId: "automation-001",
        timestamp: "2025-10-29T14:32:15Z",
        trigger: {
            type: "Email",
            source: "Gmail",
            title: "Re: Senior Frontend Engineer - Exciting Opportunity",
            subheader: "recruiter@techcorp.com",
            preview: "Hi there, I came across your profile and think you'd be a great fit...",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1b4"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning:
                "Email contains recruiter keywords and job opportunity. Matches criteria for tracking in Notion database.",
            confidence: 94
        },
        actions: [
            {
                type: "Notion Database Entry",
                target: "Recruitment Pipeline",
                details:
                    "Created new entry with company: TechCorp, position: Senior Frontend Engineer, status: New",
                url: "https://notion.so/workspace/recruitment-pipeline/techcorp-frontend-2025"
            }
        ],
        status: "success"
    }
];

export default function RunHistory() {
    const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
    const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());
    const [expandedIndividualActions, setExpandedIndividualActions] = useState<Set<string>>(new Set());

    const [currentPage, setCurrentPage] = useState(1);
    const [runsPerPage, setRunsPerPage] = useState(10);

    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(
        new Set(["success", "failed", "skipped"])
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    const filteredRuns = useMemo(() => {
        let runs = mockRunHistory.slice();

        if (selectedStatuses.size > 0 && selectedStatuses.size < 3) {
            runs = runs.filter((run) => {
                if (selectedStatuses.has("skipped") && run.filtered) return true;
                if (selectedStatuses.has(run.status as "success" | "failed")) return true;
                return false;
            });
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            runs = runs.filter((run) => {
                const matchesSubject = run.trigger.title?.toLowerCase().includes(query);
                const matchesFrom = run.trigger.title?.toLowerCase().includes(query);
                const matchesReasoning = run.decision.reasoning.toLowerCase().includes(query);
                const matchesActions = run.actions?.some(
                    (action) =>
                        action.type.toLowerCase().includes(query) ||
                        action.target.toLowerCase().includes(query) ||
                        action.details.toLowerCase().includes(query)
                );

                return (
                    !!matchesSubject ||
                    !!matchesFrom ||
                    !!matchesReasoning ||
                    !!matchesActions
                );
            });
        }

        if (dateRange.from || dateRange.to) {
            runs = runs.filter((run) => {
                const runDate = new Date(run.timestamp);
                if (dateRange.from && dateRange.to) {
                    return runDate >= dateRange.from && runDate <= dateRange.to;
                } else if (dateRange.from) {
                    return runDate >= dateRange.from;
                } else if (dateRange.to) {
                    return runDate <= dateRange.to;
                }
                return true;
            });
        }

        return runs;
    }, [selectedStatuses, searchQuery, dateRange]);

    const totalPages = Math.ceil(filteredRuns.length / runsPerPage) || 1;
    const startIndex = (currentPage - 1) * runsPerPage;
    const paginatedRuns = filteredRuns.slice(startIndex, startIndex + runsPerPage);

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
        <div className="max-w-5xl mx-auto px-6 py-8 h-full">
            <RunHistoryToolBar
                filteredCount={filteredRuns.length}
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
                    hasActiveFilters={!!searchQuery || !!dateRange.from || !!dateRange.to || selectedStatuses.size < 3}
                    onClearAll={() => {
                        setSearchQuery("");
                        setDateRange({ from: undefined, to: undefined });
                        setSelectedStatuses(new Set(["success", "failed", "skipped"]));
                        setCurrentPage(1);
                    }}
                />
            )}

            <div className="mb-6 md:space-y-3 md:overflow-visible overflow-x-auto">
                <div className="flex md:block gap-3">
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



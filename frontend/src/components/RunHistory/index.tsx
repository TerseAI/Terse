import { useMemo, useState } from "react";
import RunHistoryEmptyState from "./RunHistoryEmptyState"
import RunHistoryToolBar from "./RunHistoryToolBar";
import RunHistoryItem from "./RunHistoryItem";
import { RunHistoryRecord, RunHistoryStatus } from "../../shared/RunHistoryTypes";

const mockRunHistory: RunHistoryRecord[] = [
    {
        id: "run-001",
        automationId: "automation-001",
        timestamp: "2025-01-15T14:32:15Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Re: Senior Frontend Engineer - Exciting Opportunity",
            subheader: "recruiter@techcorp.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1b4"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Email contains recruiter keywords and job opportunity. Matches criteria for tracking in Notion database."
        },
        actions: [
            {
                type: "create database entry",
                integration: "notion",
                target: "Recruitment Pipeline",
                details: "Created new entry with company: TechCorp, position: Senior Frontend Engineer, status: New",
                url: "https://notion.so/workspace/recruitment-pipeline/techcorp-frontend-2025"
            }
        ],
        status: "success"
    },
    {
        id: "run-002",
        automationId: "automation-002",
        timestamp: "2025-01-15T16:45:22Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Invoice #2025-001 - Payment Due",
            subheader: "billing@accountingfirm.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1b5"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Invoice detected with payment due date. Needs to be tracked for accounting records."
        },
        actions: [
            {
                type: "create database entry",
                integration: "notion",
                target: "Invoices & Bills",
                details: "Added invoice with amount: $3,500.00, due date: 2025-02-01, status: Pending Payment",
                url: "https://notion.so/workspace/invoices/invoice-2025-001"
            },
            {
                type: "create calendar event",
                integration: "gmail",
                target: "Personal Calendar",
                details: "Scheduled payment reminder for Invoice #2025-001 on 2025-01-28 at 9:00 AM",
                url: "https://calendar.google.com/event?eid=xyz123"
            }
        ],
        status: "success"
    },
    {
        id: "run-003",
        automationId: "automation-003",
        timestamp: "2025-01-15T09:12:08Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Re: Project Kickoff Meeting This Week",
            subheader: "teammate@company.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1b6"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Meeting invitation found with date and participants. Should be tracked in project management."
        },
        actions: [
            {
                type: "create database entry",
                integration: "notion",
                target: "Meetings & Events",
                details: "Created meeting entry: Project Kickoff on 2025-01-18 at 2:00 PM. Participants: Sarah, Mike, Jordan",
                url: "https://notion.so/workspace/meetings/project-kickoff"
            },
            {
                type: "send notification",
                integration: "slack",
                target: "#project-team",
                details: "Sent notification about upcoming Project Kickoff meeting scheduled for this week",
                url: "https://company.slack.com/archives/C1234567890/p1234567890"
            }
        ],
        status: "success"
    },
    {
        id: "run-004",
        automationId: "automation-004",
        timestamp: "2025-01-14T11:30:45Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Unable to connect to database - urgent!",
            subheader: "devops@company.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1b7"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Critical error notification detected. Requires immediate tracking and alert."
        },
        actions: [
            {
                type: "create incident",
                integration: "notion",
                target: "Incidents & Alerts",
                details: "Created incident entry for database connectivity issue. Status: Investigating, Priority: High",
                url: "https://notion.so/workspace/incidents/db-connectivity-20250114"
            },
            {
                type: "send notification",
                integration: "slack",
                target: "#engineering-alerts",
                details: "Alerted engineering team about database connectivity issue",
                url: "https://company.slack.com/archives/C9876543210/p1234567891"
            },
            {
                type: "create calendar event",
                integration: "gmail",
                target: "Work Calendar",
                details: "Added urgent follow-up reminder for database incident resolution",
                url: "https://calendar.google.com/event?eid=abc789"
            }
        ],
        status: "success"
    },
    {
        id: "run-005",
        automationId: "automation-005",
        timestamp: "2025-01-14T20:15:33Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Important: Server maintenance scheduled",
            subheader: "infrastructure@company.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1b8"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Maintenance window notification received. Failed to create calendar entry due to API rate limit."
        },
        actions: [
            {
                type: "create database entry",
                integration: "notion",
                target: "Operations Log",
                details: "Failed to create calendar entry due to Google Calendar API rate limit exceeded",
                url: "https://notion.so/workspace/operations/log-entry-123"
            }
        ],
        status: "failed"
    },
    {
        id: "run-006",
        automationId: "automation-006",
        timestamp: "2025-01-15T10:20:17Z",
        trigger: {
            type: "database row created",
            integration: "notion",
            source: "Notion",
            title: "New Task Created in Engineering Backlog",
            subheader: "Engineering Backlog - tasks database",
            url: "https://notion.so/workspace/engineering-backlog/task-12345"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "New high-priority task detected in engineering backlog. Currently processing..."
        },
        actions: [],
        status: "in_progress"
    },
    {
        id: "run-007",
        automationId: "automation-001",
        timestamp: "2025-01-13T13:45:12Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Weekly Newsletter - Tech Trends",
            subheader: "newsletter@techblog.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1b9"
        },
        filtered: true,
        decision: {
            action: "skipped",
            reasoning: "Email is a promotional newsletter and does not match automation criteria."
        },
        actions: [],
        status: "skipped"
    },
    {
        id: "run-008",
        automationId: "automation-002",
        timestamp: "2025-01-13T08:55:41Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Your order has been delivered",
            subheader: "orders@ecommercestore.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1ba"
        },
        filtered: true,
        decision: {
            action: "skipped",
            reasoning: "Order confirmation email is transactional and does not require tracking in knowledge base."
        },
        actions: [],
        status: "skipped"
    },
    {
        id: "run-009",
        automationId: "automation-007",
        timestamp: "2025-01-12T15:33:29Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Re: Q4 2024 Performance Review Discussion",
            subheader: "manager@company.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1bb"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Performance review email detected with important context about achievements and goals."
        },
        actions: [
            {
                type: "create database entry",
                integration: "notion",
                target: "Career Development",
                details: "Documented Q4 2024 performance review discussion with key achievements and future goals",
                url: "https://notion.so/workspace/career/review-q4-2024"
            }
        ],
        status: "success"
    },
    {
        id: "run-010",
        automationId: "automation-004",
        timestamp: "2025-01-12T07:22:56Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Authentication error in production",
            subheader: "alerts@monitoring.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1bc"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Critical authentication error detected in production environment."
        },
        actions: [
            {
                type: "create incident",
                integration: "notion",
                target: "Incidents & Alerts",
                details: "Created incident for production authentication errors. Error count: 127 occurrences in last hour",
                url: "https://notion.so/workspace/incidents/auth-error-production"
            },
            {
                type: "send notification",
                integration: "slack",
                target: "#oncall",
                details: "Paged on-call engineer for critical production incident",
                url: "https://company.slack.com/archives/C1112223333/p1234567892"
            }
        ],
        status: "success"
    },
    {
        id: "run-011",
        automationId: "automation-008",
        timestamp: "2025-01-11T18:14:37Z",
        trigger: {
            type: "calendar event updated",
            integration: "gmail",
            source: "Google Calendar",
            title: "Team Standup - Postponed",
            subheader: "Daily Team Standup recurring meeting",
            url: "https://calendar.google.com/event?eid=standup789"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Calendar event modification detected (postponement). Updating Notion team page."
        },
        actions: [
            {
                type: "update database entry",
                integration: "notion",
                target: "Team Calendar",
                details: "Updated Team Standup status: postponed to tomorrow due to schedule conflict",
                url: "https://notion.so/workspace/team/standup-updates"
            }
        ],
        status: "success"
    },
    {
        id: "run-012",
        automationId: "automation-003",
        timestamp: "2025-01-10T12:00:05Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Conference Call - Sales Demo Feedback",
            subheader: "client@partnerventures.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1bd"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Client feedback email about sales demo. Tracking for follow-up actions."
        },
        actions: [
            {
                type: "create database entry",
                integration: "notion",
                target: "Sales Pipeline",
                details: "Added client feedback: interested in enterprise tier, requesting custom demo next week",
                url: "https://notion.so/workspace/sales/partnerventures-deal"
            },
            {
                type: "create calendar event",
                integration: "gmail",
                target: "Work Calendar",
                details: "Scheduled custom demo preparation for next week",
                url: "https://calendar.google.com/event?eid=demo456"
            }
        ],
        status: "success"
    },
    {
        id: "run-013",
        automationId: "automation-005",
        timestamp: "2025-01-09T14:47:21Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Budget approval required for Q1 projects",
            subheader: "finance@company.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1be"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Failed to parse budget email due to malformed attachment. Retry needed."
        },
        actions: [
            {
                type: "create database entry",
                integration: "notion",
                target: "Budget Requests",
                details: "Failed to process: attachment parsing error. Action required: manual review needed",
                url: "https://notion.so/workspace/finance/budget-q1-parsing-error"
            }
        ],
        status: "failed"
    },
    {
        id: "run-014",
        automationId: "automation-006",
        timestamp: "2025-01-09T16:30:55Z",
        trigger: {
            type: "database row updated",
            integration: "notion",
            source: "Notion",
            title: "Milestone Reached: 1000 Users",
            subheader: "Product Metrics - growth database",
            url: "https://notion.so/workspace/product/metrics-milestone-1000"
        },
        filtered: false,
        decision: {
            action: "processed",
            reasoning: "Product milestone achievement detected. Processing celebration automation..."
        },
        actions: [],
        status: "in_progress"
    },
    {
        id: "run-015",
        automationId: "automation-001",
        timestamp: "2025-01-08T09:18:43Z",
        trigger: {
            type: "email received",
            integration: "gmail",
            source: "Gmail",
            title: "Spam Test Email - Ignore This",
            subheader: "spammer@sketchywebsite.com",
            url: "https://mail.google.com/mail/u/0/#inbox/18b5c7f9a3e2d1bf"
        },
        filtered: true,
        decision: {
            action: "skipped",
            reasoning: "Email flagged as spam. Multiple red flags including suspicious sender domain and typical spam patterns."
        },
        actions: [],
        status: "skipped"
    }
];

export default function RunHistory() {
    const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
    const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());
    const [expandedIndividualActions, setExpandedIndividualActions] = useState<Set<string>>(new Set());

    const [currentPage, setCurrentPage] = useState(1);
    const [runsPerPage, setRunsPerPage] = useState(10);

    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(
        new Set(["success", "failed", "skipped", "in_progress"])
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined
    });

    const filteredRuns = useMemo(() => {
        let runs = mockRunHistory.slice();

        if (selectedStatuses.size > 0 && selectedStatuses.size < 4) {
            runs = runs.filter((run) => {
                if (selectedStatuses.has("skipped") && run.filtered) return true;
                if (selectedStatuses.has(run.status as "success" | "failed" | "in_progress")) return true;
                return false;
            });
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            runs = runs.filter((run) => {
                const matchesSubject = run.trigger.title?.toLowerCase().includes(query);
                const matchesFrom = run.trigger.subheader?.toLowerCase().includes(query);
                const matchesReasoning = run.decision.reasoning.toLowerCase().includes(query);
                const matchesActions = run.actions?.some(
                    (action) =>
                        action.type.toLowerCase().includes(query) ||
                        action.integration.toLowerCase().includes(query) ||
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

        // Sort by timestamp descending (most recent first)
        runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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



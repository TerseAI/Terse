import { useCallback, useState } from "react"
import { useNavigate } from "react-router-dom"

import { ExternalLink, MessageSquare, Zap } from "lucide-react"

import DateRangePicker from "@/components/RunHistory/DatePicker"
import RunHistoryChatDrawer from "@/components/RunHistory/RunHistoryChatDrawer"
import RunHistoryEmptyState from "@/components/RunHistory/RunHistoryEmptyState"
import RunHistoryPagination from "@/components/RunHistory/RunHistoryPagination"
import RunHistoryStatusBadge from "@/components/RunHistory/RunHistoryStatusBadge"
import { SearchBar } from "@/components/RunHistory/SearchBar"
import StatusFilter from "@/components/RunHistory/StatusFilter"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllRunHistory } from "@/hooks/api/useAllRunHistory"
import { IconForIntegration } from "@/pages/Agents/components/Integration"
import { FrontendRoutes } from "@/shared/FrontendRoutes"
import type { RunHistoryRecordWithAgent, RunHistoryStatus, RunHistoryTrigger } from "@/shared/RunHistoryTypes"
import { formatTimestamp } from "@/utility/timeUtils"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActivityRow({ run, onOpenChat }: { run: RunHistoryRecordWithAgent; onOpenChat: (run: RunHistoryRecordWithAgent) => void }) {
    const navigate = useNavigate()
    const title = run.trigger.title || run.trigger.source
    const writeActions = (run.actions ?? []).filter(a => a.type !== "read")

    return (
        <div className="group flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-muted/40">
            {/* Integration icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
                <IconForIntegration integration={run.trigger.integration} />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{title}</span>
                    {run.trigger.url && (
                        <a
                            href={run.trigger.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                        onClick={() => navigate(FrontendRoutes.AGENTS.DETAIL(run.agentId))}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[160px]"
                        title={run.agentName}
                    >
                        {run.agentName}
                    </button>
                    {run.trigger.subheader && (
                        <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{run.trigger.subheader}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Write actions count */}
            {writeActions.length > 0 && (
                <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
                    {run.isManuallyTriggered && <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-accent-tertiary flex-shrink-0">Manual</span>}
                    <Zap className="w-3 h-3" />
                    <span>
                        {writeActions.length} action{writeActions.length !== 1 ? "s" : ""}
                    </span>
                </div>
            )}

            {/* Status */}
            <RunHistoryStatusBadge status={run.status} filtered={run.filtered} className="hidden sm:flex" />

            {/* Timestamp */}
            <span className="text-xs text-muted-foreground whitespace-nowrap w-20 text-right">{formatTimestamp(run.timestamp)}</span>

            {/* Chat button */}
            <Button variant="ghost" size="icon-sm" onClick={() => onOpenChat(run)} className="opacity-0 group-hover:opacity-100 transition-opacity" title="View run details">
                <MessageSquare className="w-3.5 h-3.5" />
            </Button>
        </div>
    )
}

function LoadingSkeleton() {
    return (
        <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                    <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-[280px]" />
                        <Skeleton className="h-3 w-[180px]" />
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
    const [selectedStatuses, setSelectedStatuses] = useState<Set<RunHistoryStatus>>(new Set(["success", "failed", "in_progress", "awaiting_approval"]))
    const [searchQuery, setSearchQuery] = useState("")
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined })

    // Drawer state
    const [selectedRun, setSelectedRun] = useState<RunHistoryRecordWithAgent | null>(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    const { runs, total, isLoading } = useAllRunHistory({
        page: currentPage,
        pageSize: runsPerPage,
        searchQuery,
        dateRange,
        selectedStatuses
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

    const handleRunsPerPageChange = (value: number) => {
        setRunsPerPage(value)
        setCurrentPage(1)
    }

    const handleOpenChat = useCallback((run: RunHistoryRecordWithAgent) => {
        setSelectedRun(run)
        setIsDrawerOpen(true)
    }, [])

    const handleDrawerClose = useCallback((open: boolean) => {
        setIsDrawerOpen(open)
        if (!open) setSelectedRun(null)
    }, [])

    const hasActiveFilters = !!searchQuery || !!dateRange.from || !!dateRange.to || selectedStatuses.size < 5

    const drawerTrigger: RunHistoryTrigger | undefined = selectedRun
        ? {
              event: selectedRun.trigger.event,
              integration: selectedRun.trigger.integration,
              source: selectedRun.trigger.source,
              title: selectedRun.trigger.title,
              subheader: selectedRun.trigger.subheader,
              url: selectedRun.trigger.url
          }
        : undefined

    const startIndex = (currentPage - 1) * runsPerPage

    return (
        <div className="mx-auto max-w-5xl w-full px-6 py-8">
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">Activity</h1>
                <p className="text-muted-foreground mt-1 text-sm">A complete record of activity across your agents.</p>
            </div>

            {/* ── Toolbar ─────────────────────────────────────────── */}
            <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between gap-4">
                    <SearchBar searchQuery={searchQuery} onSearchChange={handleSearchChange} placeholder="Search by event or agent name..." className="max-w-sm" />

                    <div className="flex items-center gap-3">
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
            <div className="rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm overflow-hidden">
                {isLoading ? (
                    <LoadingSkeleton />
                ) : runs.length === 0 ? (
                    <div className="py-12">
                        <RunHistoryEmptyState
                            hasActiveFilters={hasActiveFilters}
                            onClearAll={() => {
                                setSearchQuery("")
                                setDateRange({ from: undefined, to: undefined })
                                setSelectedStatuses(new Set(["success", "failed", "skipped", "in_progress", "awaiting_approval"]))
                                setCurrentPage(1)
                            }}
                        />
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {runs.map(run => (
                            <ActivityRow key={run.id} run={run} onOpenChat={handleOpenChat} />
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

            {/* ── Run History Chat Drawer ────────────────────────── */}
            {selectedRun && drawerTrigger && (
                <RunHistoryChatDrawer
                    runId={selectedRun.id}
                    isOpen={isDrawerOpen}
                    onOpenChange={handleDrawerClose}
                    status={selectedRun.status as RunHistoryStatus}
                    trigger={drawerTrigger}
                    filtered={selectedRun.filtered}
                />
            )}
        </div>
    )
}

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Filter as FilterIcon, XCircle, Loader2, ChevronRight } from "lucide-react";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";
import RunHistoryPagination from "./RunHistoryPagination";
import { SearchBar } from "../Automation/SearchBar";
import DateRangePicker from "./DatePicker";

type DateRangeType = { from: Date | undefined; to: Date | undefined };

type Props = {
    filteredCount: number;
    startIndex: number;
    runsPerPage: number;

    searchQuery: string;
    onSearchChange: (value: string) => void;

    dateRange: DateRangeType;
    onDateRangeChange: (next: DateRangeType) => void;

    selectedStatuses: Set<RunHistoryStatus>;
    onToggleStatus: (status: RunHistoryStatus) => void;

    runsPerPageValue: number;
    onRunsPerPageChange: (value: number) => void;

    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
};

export default function RunHistoryToolBar({
    filteredCount,
    startIndex,
    runsPerPage,
    searchQuery,
    onSearchChange,
    dateRange,
    onDateRangeChange,
    selectedStatuses,
    onToggleStatus,
    runsPerPageValue,
    onRunsPerPageChange,
    currentPage,
    totalPages,
    onPageChange
}: Props) {
    const [isDateOpen, setIsDateOpen] = useState(false);
    const statusPanelRef = useRef<HTMLDivElement | null>(null);
    const statusButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        const handleClickOutsideStatus = (e: MouseEvent) => {
            const target = e.target as Node;
            const panel = statusPanelRef.current;
            const button = statusButtonRef.current;
            if (!panel) return;
            const isHidden = panel.classList.contains('hidden');
            if (isHidden) return;
            if (
                (!panel.contains(target)) &&
                (!button || !button.contains(target))
            ) {
                panel.classList.add('hidden');
            }
        };
        document.addEventListener('mousedown', handleClickOutsideStatus);
        return () => document.removeEventListener('mousedown', handleClickOutsideStatus);
    }, []);

    return (
        <div className="mb-6 space-y-4 relative">
            <div className="mb-4 text-muted-foreground">
                Showing {filteredCount === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + runsPerPage, filteredCount)} of {filteredCount} runs
            </div>

            <div className="flex items-center justify-between gap-4">
               <SearchBar searchQuery={searchQuery} onSearchChange={onSearchChange} placeholder="Search runs..." />

                <div className="flex items-center gap-4">
                    <DateRangePicker
                        dateRange={dateRange}
                        onDateRangeChange={onDateRangeChange}
                        open={isDateOpen}
                        onOpenChange={(open) => {
                            setIsDateOpen(open);
                            if (open) {
                                const statusPanel = document.getElementById("status-filter-panel");
                                if (statusPanel && !statusPanel.classList.contains("hidden")) {
                                    statusPanel.classList.add("hidden");
                                }
                            }
                        }}
                    />

                    <div className="relative">
                        <button
                            ref={statusButtonRef}
                            className="h-9 px-3 rounded-md border text-sm transition-colors flex items-center border-input text-muted-foreground hover:text-foreground hover:bg-accent/10"
                            onClick={() => {
                                const statusPanel = document.getElementById("status-filter-panel");
                                setIsDateOpen(false);
                                if (statusPanel) statusPanel.classList.toggle("hidden");
                            }}
                            type="button"
                        >
                            <FilterIcon className="w-4 h-4 mr-2" />
                            {selectedStatuses.size === 4
                                ? "All Status"
                                : selectedStatuses.size === 0
                                ? "No Status"
                                : `${selectedStatuses.size} Status`}
                            <ChevronRight className="ml-2 h-4 w-4 rotate-90" />
                        </button>
                        <div id="status-filter-panel" ref={statusPanelRef} className="hidden absolute z-50 right-0 mt-2 w-56 p-3 rounded-md border bg-card border-input">
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-green-600 dark:accent-green-400"
                                        checked={selectedStatuses.has("success")}
                                        onChange={() => onToggleStatus("success")}
                                    />
                                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    <span>Success</span>
                                </label>
                                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-destructive"
                                        checked={selectedStatuses.has("failed")}
                                        onChange={() => onToggleStatus("failed")}
                                    />
                                    <XCircle className="w-4 h-4 text-destructive" />
                                    <span>Failed</span>
                                </label>
                                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-accent"
                                        checked={selectedStatuses.has("in_progress")}
                                        onChange={() => onToggleStatus("in_progress")}
                                    />
                                    <Loader2 className="w-4 h-4 text-accent" />
                                    <span>In Progress</span>
                                </label>
                                <label className="flex items-center gap-2 text-foreground cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-muted-foreground"
                                        checked={selectedStatuses.has("skipped")}
                                        onChange={() => onToggleStatus("skipped")}
                                    />
                                    <FilterIcon className="w-4 h-4 text-muted-foreground" />
                                    <span>Filtered</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center justify-start gap-4">
                    <RunHistoryPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={onPageChange}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Runs per page:</span>
                    <select
                        className="w-20 h-9 rounded-md border border-input bg-card text-foreground px-2"
                        value={String(runsPerPageValue)}
                        onChange={(e) => onRunsPerPageChange(Number(e.target.value))}
                    >
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="100">100</option>
                    </select>
                </div>
            </div>
        </div>
    );
}




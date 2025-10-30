import { useEffect, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar as CalendarIcon, CheckCircle2, ChevronLeft, ChevronRight, Filter as FilterIcon, Search as SearchIcon, XCircle, Loader2 } from "lucide-react";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";
import RunHistoryPagination from "./RunHistoryPagination";

type DateRange = { from: Date | undefined; to: Date | undefined };

type Props = {
    filteredCount: number;
    startIndex: number;
    runsPerPage: number;

    searchQuery: string;
    onSearchChange: (value: string) => void;

    dateRange: DateRange;
    onDateRangeChange: (next: DateRange) => void;

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
    const datePanelRef = useRef<HTMLDivElement | null>(null);
    const dateButtonRef = useRef<HTMLButtonElement | null>(null);
    const statusPanelRef = useRef<HTMLDivElement | null>(null);
    const statusButtonRef = useRef<HTMLButtonElement | null>(null);
    const [datePanelPosition, setDatePanelPosition] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!isDateOpen) return;
            const target = e.target as Node;
            if (
                datePanelRef.current && !datePanelRef.current.contains(target) &&
                dateButtonRef.current && !dateButtonRef.current.contains(target)
            ) {
                setIsDateOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDateOpen]);

    useEffect(() => {
        if (isDateOpen && dateButtonRef.current) {
            const rect = dateButtonRef.current.getBoundingClientRect();
            setDatePanelPosition({ top: rect.bottom + 8, left: rect.left });
        }
    }, [isDateOpen]);

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

    const isDateInRange = (d: Date, from?: Date, to?: Date) => {
        if (!from && !to) return false;
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (from && !to) return day.getTime() === new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
        if (!from && to) return day.getTime() === new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
        return !!from && !!to && day >= new Date(from.getFullYear(), from.getMonth(), from.getDate()) && day <= new Date(to.getFullYear(), to.getMonth(), to.getDate());
    };

    return (
        <div className="mb-6 space-y-4 relative">
            <div className="mb-4 text-slate-400">
                Showing {filteredCount === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + runsPerPage, filteredCount)} of {filteredCount} runs
            </div>

            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search runs..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pl-9 w-full rounded-md border border-slate-700 bg-[#242424] text-slate-300 placeholder:text-slate-500 h-9 px-3"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <button
                            ref={dateButtonRef}
                            className={`h-9 px-3 rounded-md border text-sm transition-colors flex items-center border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 ${
                                dateRange.from || dateRange.to ? "border-emerald-500/50 text-emerald-400" : ""
                            }`}
                            onClick={() => {
                                const statusPanel = document.getElementById("status-filter-panel");
                                if (statusPanel && !statusPanel.classList.contains("hidden")) statusPanel.classList.add("hidden");
                                setIsDateOpen(!isDateOpen);
                            }}
                            aria-expanded={isDateOpen}
                            type="button"
                        >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            {dateRange.from ? (
                                dateRange.to ? (
                                    `${dateRange.from.toLocaleDateString("en-US", { month: "short", day: "2-digit" })} - ${dateRange.to.toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`
                                ) : (
                                    dateRange.from.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                                )
                            ) : (
                                "Date Range"
                            )}
                        </button>
                        <div
                            id="date-range-panel"
                            ref={datePanelRef}
                            className={`${isDateOpen ? '' : 'hidden'} fixed z-50 p-3 rounded-md border bg-[theme(background-elevated)] border-[theme(border)] shadow-lg`}
                            style={datePanelPosition ? { top: `${datePanelPosition.top}px`, left: `${datePanelPosition.left}px` } : undefined}
                        >
                            <DatePicker
                                selected={dateRange.from ?? null}
                                onChange={(dates) => {
                                    const [start, end] = dates as [Date | null, Date | null];
                                    onDateRangeChange({ from: start ?? undefined, to: end ?? undefined });
                                    if (start && end) {
                                        setIsDateOpen(false);
                                    }
                                }}
                                startDate={dateRange.from ?? null}
                                endDate={dateRange.to ?? null}
                                selectsRange
                                inline
                                monthsShown={1}
                                calendarClassName="rounded-md bg-[theme(background-elevated)] border border-[theme(border)] text-[theme(text-primary)]"
                                wrapperClassName="react-datepicker-wrapper"
                                dayClassName={(d) =>
                                    `h-8 w-8 leading-8 text-center rounded text-sm text-[theme(text-primary)] hover:bg-[theme(background-surface)] ${
                                        isDateInRange(d, dateRange.from, dateRange.to)
                                            ? 'bg-[var(--color-accent)] text-black'
                                            : ''
                                    }`
                                }
                                renderCustomHeader={({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
                                    <div className="flex items-center justify-between px-2 py-1 text-slate-300">
                                        <button
                                            onClick={decreaseMonth}
                                            disabled={prevMonthButtonDisabled}
                                            className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40"
                                            type="button"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-sm">
                                            {date.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button
                                            onClick={increaseMonth}
                                            disabled={nextMonthButtonDisabled}
                                            className="h-7 w-7 inline-flex items-center justify-center rounded border border-slate-700 hover:bg-slate-800 disabled:opacity-40"
                                            type="button"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            />
                            <div className="mt-3 flex gap-2">
                                {(dateRange.from || dateRange.to) && (
                                    <button
                                        className="flex-1 h-8 rounded-md border text-sm border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                                        onClick={() => {
                                            onDateRangeChange({ from: undefined, to: undefined });
                                        }}
                                        type="button"
                                    >
                                        Clear Date Range
                                    </button>
                                )}
                                <button
                                    className="h-8 px-3 rounded-md border text-sm border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                                    onClick={() => {
                                        setIsDateOpen(false);
                                    }}
                                    type="button"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <button
                            ref={statusButtonRef}
                            className="h-9 px-3 rounded-md border text-sm transition-colors flex items-center border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
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
                        <div id="status-filter-panel" ref={statusPanelRef} className="hidden absolute z-50 right-0 mt-2 w-56 p-3 rounded-md border bg-[#242424] border-slate-700">
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-emerald-500"
                                        checked={selectedStatuses.has("success")}
                                        onChange={() => onToggleStatus("success")}
                                    />
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span>Success</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-red-500"
                                        checked={selectedStatuses.has("failed")}
                                        onChange={() => onToggleStatus("failed")}
                                    />
                                    <XCircle className="w-4 h-4 text-red-400" />
                                    <span>Failed</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-blue-500"
                                        checked={selectedStatuses.has("in_progress")}
                                        onChange={() => onToggleStatus("in_progress")}
                                    />
                                    <Loader2 className="w-4 h-4 text-blue-400" />
                                    <span>In Progress</span>
                                </label>
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-slate-400"
                                        checked={selectedStatuses.has("skipped")}
                                        onChange={() => onToggleStatus("skipped")}
                                    />
                                    <FilterIcon className="w-4 h-4 text-slate-400" />
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
                    <span className="text-slate-400 text-sm">Runs per page:</span>
                    <select
                        className="w-20 h-9 rounded-md border border-slate-700 bg-[#242424] text-slate-300 px-2"
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




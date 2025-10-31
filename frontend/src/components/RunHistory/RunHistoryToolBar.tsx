import { useState } from "react";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";
import RunHistoryPagination from "./RunHistoryPagination";
import { SearchBar } from "../Automation/SearchBar";
import DateRangePicker from "./DatePicker";
import StatusFilter from "./StatusFilter";

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
    const [isStatusOpen, setIsStatusOpen] = useState(false);

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
                                setIsStatusOpen(false);
                            }
                        }}
                    />

                    <StatusFilter
                        selectedStatuses={selectedStatuses}
                        onToggleStatus={onToggleStatus}
                        open={isStatusOpen}
                        onOpenChange={(open) => {
                            setIsStatusOpen(open);
                            if (open) {
                                setIsDateOpen(false);
                            }
                        }}
                    />
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




import { useState } from "react"

import { PlayIcon } from "lucide-react"

import type { RunHistoryStatus } from "../../shared/RunHistoryTypes"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

import DateRangePicker from "./DatePicker"
import RunHistoryPagination from "./RunHistoryPagination"
import { SearchBar } from "./SearchBar"
import StatusFilter from "./StatusFilter"

type DateRangeType = { from: Date | undefined; to: Date | undefined }

type Props = {
    filteredCount: number
    startIndex: number
    runsPerPage: number

    searchQuery: string
    onSearchChange: (value: string) => void

    dateRange: DateRangeType
    onDateRangeChange: (next: DateRangeType) => void

    selectedStatuses: Set<RunHistoryStatus>
    onToggleStatus: (status: RunHistoryStatus) => void

    runsPerPageValue: number
    onRunsPerPageChange: (value: number) => void

    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void

    onTriggerNow?: () => void
}

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
    onPageChange,
    onTriggerNow
}: Props) {
    const [isDateOpen, setIsDateOpen] = useState(false)
    const [isStatusOpen, setIsStatusOpen] = useState(false)

    return (
        <div className="mb-6 space-y-3 relative">
            <div className="flex items-center justify-between gap-4">
                <SearchBar searchQuery={searchQuery} onSearchChange={onSearchChange} placeholder="Search events..." />

                <div className="flex items-center gap-2">
                    <DateRangePicker
                        dateRange={dateRange}
                        onDateRangeChange={onDateRangeChange}
                        open={isDateOpen}
                        onOpenChange={open => {
                            setIsDateOpen(open)
                            if (open) {
                                setIsStatusOpen(false)
                            }
                        }}
                    />

                    <StatusFilter
                        selectedStatuses={selectedStatuses}
                        onToggleStatus={onToggleStatus}
                        open={isStatusOpen}
                        onOpenChange={open => {
                            setIsStatusOpen(open)
                            if (open) {
                                setIsDateOpen(false)
                            }
                        }}
                    />

                    {onTriggerNow && (
                        <Button variant="outline" size="sm" onClick={onTriggerNow}>
                            <PlayIcon className="size-3.5" />
                            Trigger Now
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <RunHistoryPagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
                    <span className="text-muted-foreground text-xs">
                        {filteredCount === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + runsPerPage, filteredCount)} of {filteredCount}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Per page</span>
                    <Select value={String(runsPerPageValue)} onValueChange={value => onRunsPerPageChange(Number(value))}>
                        <SelectTrigger className="h-7 w-16 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}

import { useState } from "react"

import { PlayIcon } from "lucide-react"
import type { RunHistoryStatus } from "terse-types"

import { Button } from "@/components/ui/button"

import DateRangePicker from "./DatePicker"
import { SearchBar } from "./SearchBar"
import StatusFilter from "./StatusFilter"

type DateRangeType = { from: Date | undefined; to: Date | undefined }

type Props = {
    searchQuery: string
    onSearchChange: (value: string) => void

    dateRange: DateRangeType
    onDateRangeChange: (next: DateRangeType) => void

    selectedStatuses: Set<RunHistoryStatus>
    onToggleStatus: (status: RunHistoryStatus) => void

    includeTest: boolean
    onToggleIncludeTest: () => void

    onTriggerNow?: () => void
}

export default function RunHistoryToolBar({ searchQuery, onSearchChange, dateRange, onDateRangeChange, selectedStatuses, onToggleStatus, includeTest, onToggleIncludeTest, onTriggerNow }: Props) {
    const [isDateOpen, setIsDateOpen] = useState(false)
    const [isStatusOpen, setIsStatusOpen] = useState(false)

    return (
        <div className="relative mb-3 flex items-center justify-between gap-4">
            <SearchBar searchQuery={searchQuery} onSearchChange={onSearchChange} placeholder="Search events…" />

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
                    includeTest={includeTest}
                    onToggleIncludeTest={onToggleIncludeTest}
                    open={isStatusOpen}
                    onOpenChange={open => {
                        setIsStatusOpen(open)
                        if (open) {
                            setIsDateOpen(false)
                        }
                    }}
                />

                {onTriggerNow && (
                    <Button variant="outline" onClick={onTriggerNow}>
                        <PlayIcon className="w-4 h-4" />
                        Trigger Now
                    </Button>
                )}
            </div>
        </div>
    )
}

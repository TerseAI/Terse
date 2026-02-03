import { DateRange } from "react-day-picker"

import { Calendar as CalendarIcon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"

import { Button } from "../ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

type DateRangeType = { from: Date | undefined; to: Date | undefined }

type DateRangePickerProps = {
    dateRange: DateRangeType
    onDateRangeChange: (range: DateRangeType) => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

function DateRangePicker({ dateRange, onDateRangeChange, open, onOpenChange }: DateRangePickerProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={`justify-start text-left font-normal ${dateRange.from || dateRange.to ? "border-green-600 dark:border-green-400 text-green-600 dark:text-green-400" : ""}`}
                >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {dateRange.from
                        ? dateRange.to
                            ? `${dateRange.from.toLocaleDateString("en-US", { month: "short", day: "2-digit" })} - ${dateRange.to.toLocaleDateString("en-US", { month: "short", day: "2-digit" })}`
                            : dateRange.from.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
                        : "Date Range"}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to } as DateRange}
                    onSelect={(range: DateRange | undefined) => {
                        if (range) {
                            onDateRangeChange({ from: range.from, to: range.to })
                        } else {
                            onDateRangeChange({ from: undefined, to: undefined })
                        }
                    }}
                    numberOfMonths={1}
                    initialFocus
                />
                {(dateRange.from || dateRange.to) && (
                    <div className="p-3 border-t">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                onDateRangeChange({ from: undefined, to: undefined })
                            }}
                        >
                            Clear Date Range
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}

export default DateRangePicker

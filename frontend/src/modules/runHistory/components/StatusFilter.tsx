import { Ban, CheckCircle2, ChevronDown, Clock, Filter as FilterIcon, Loader2, PauseCircle, XCircle } from "lucide-react"
import { RunHistoryStatus } from "terse-types"

import StatusBadge from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type StatusFilterProps = {
    selectedStatuses: Set<RunHistoryStatus>
    onToggleStatus: (status: RunHistoryStatus) => void
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

function StatusFilter({ selectedStatuses, onToggleStatus, open, onOpenChange }: StatusFilterProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="outline">
                    <FilterIcon className="w-16 h-16" />
                    {selectedStatuses.size === Object.values(RunHistoryStatus).length ? "All Status" : selectedStatuses.size === 0 ? "No Status" : `${selectedStatuses.size} Status`}
                    <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
                <fieldset className="space-y-3">
                    <legend className="sr-only">Filter by status</legend>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.SUCCESS)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.SUCCESS)} />
                        <StatusBadge text="Success" icon={CheckCircle2} iconClassName="w-16 h-16" status="success" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.FAILED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.FAILED)} />
                        <StatusBadge text="Failed" icon={XCircle} iconClassName="w-16 h-16" status="error" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.CANCELLED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.CANCELLED)} />
                        <StatusBadge text="Cancelled" icon={Ban} iconClassName="size-16" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.IN_PROGRESS)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.IN_PROGRESS)} />
                        <StatusBadge text="In Progress" icon={Loader2} iconClassName="w-16 h-16" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.SKIPPED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.SKIPPED)} />
                        <StatusBadge text="Filtered" icon={FilterIcon} iconClassName="size-16" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.AWAITING_APPROVAL)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.AWAITING_APPROVAL)} />
                        <StatusBadge text="Awaiting Approval" icon={Clock} status="warning" iconClassName="w-16 h-16" />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.SUSPENDED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.SUSPENDED)} />
                        <StatusBadge text="Suspended" icon={PauseCircle} status="warning" iconClassName="w-16 h-16" />
                    </label>
                </fieldset>
            </PopoverContent>
        </Popover>
    )
}

export default StatusFilter

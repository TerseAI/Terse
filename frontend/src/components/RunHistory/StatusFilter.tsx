import { Ban, CheckCircle2, ChevronDown, Clock, Filter as FilterIcon, Loader2, XCircle } from "lucide-react"

import { RunHistoryStatus } from "../../shared/RunHistoryTypes"
import StatusBadge from "../StatusBadge"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

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
                <div className="space-y-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.SUCCESS)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.SUCCESS)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.SUCCESS)} />
                        <StatusBadge text="Success" icon={CheckCircle2} iconClassName="w-16 h-16" status="success" />
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.FAILED)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.FAILED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.FAILED)} />
                        <StatusBadge text="Failed" icon={XCircle} iconClassName="w-16 h-16" status="error" />
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.CANCELLED)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.CANCELLED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.CANCELLED)} />
                        <StatusBadge text="Cancelled" icon={Ban} iconClassName="size-16" />
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.IN_PROGRESS)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.IN_PROGRESS)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.IN_PROGRESS)} />
                        <StatusBadge text="In Progress" icon={Loader2} iconClassName="w-16 h-16" />
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.SKIPPED)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.SKIPPED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.SKIPPED)} />
                        <StatusBadge text="Filtered" icon={FilterIcon} iconClassName="size-16" />
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.AWAITING_APPROVAL)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.AWAITING_APPROVAL)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.AWAITING_APPROVAL)} />
                        <StatusBadge text="Awaiting Approval" icon={Clock} status="warning" iconClassName="w-16 h-16" />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default StatusFilter

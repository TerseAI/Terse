import { Ban, CheckCircle2, ChevronDown, Clock, Filter as FilterIcon, Loader2, XCircle } from "lucide-react"

import { RunHistoryStatus } from "../../shared/RunHistoryTypes"
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
                    <FilterIcon className="w-4 h-4" />
                    {selectedStatuses.size === Object.values(RunHistoryStatus).length ? "All Status" : selectedStatuses.size === 0 ? "No Status" : `${selectedStatuses.size} Status`}
                    <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
                <div className="space-y-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.SUCCESS)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.SUCCESS)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.SUCCESS)} />
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm">Success</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.FAILED)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.FAILED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.FAILED)} />
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm">Failed</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.CANCELLED)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.CANCELLED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.CANCELLED)} />
                        <Ban className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Cancelled</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.IN_PROGRESS)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.IN_PROGRESS)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.IN_PROGRESS)} />
                        <Loader2 className="w-4 h-4 text-accent" />
                        <span className="text-sm">In Progress</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.SKIPPED)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.SKIPPED)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.SKIPPED)} />
                        <FilterIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Filtered</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus(RunHistoryStatus.AWAITING_APPROVAL)}>
                        <Checkbox checked={selectedStatuses.has(RunHistoryStatus.AWAITING_APPROVAL)} onCheckedChange={() => onToggleStatus(RunHistoryStatus.AWAITING_APPROVAL)} />
                        <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-sm">Awaiting Approval</span>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

export default StatusFilter

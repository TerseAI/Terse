import { CheckCircle2, Filter as FilterIcon, XCircle, Loader2, Clock, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";

type StatusFilterProps = {
    selectedStatuses: Set<RunHistoryStatus>;
    onToggleStatus: (status: RunHistoryStatus) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

function StatusFilter({ 
    selectedStatuses, 
    onToggleStatus, 
    open, 
    onOpenChange 
}: StatusFilterProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <Button variant="outline">
                    <FilterIcon className="w-4 h-4 mr-2" />
                    {selectedStatuses.size === 5
                        ? "All Status"
                        : selectedStatuses.size === 0
                        ? "No Status"
                        : `${selectedStatuses.size} Status`}
                    <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
                <div className="space-y-3">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus("success")}>
                        <Checkbox
                            checked={selectedStatuses.has("success")}
                            onCheckedChange={() => onToggleStatus("success")}
                        />
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm">Success</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus("failed")}>
                        <Checkbox
                            checked={selectedStatuses.has("failed")}
                            onCheckedChange={() => onToggleStatus("failed")}
                        />
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm">Failed</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus("in_progress")}>
                        <Checkbox
                            checked={selectedStatuses.has("in_progress")}
                            onCheckedChange={() => onToggleStatus("in_progress")}
                        />
                        <Loader2 className="w-4 h-4 text-accent" />
                        <span className="text-sm">In Progress</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus("skipped")}>
                        <Checkbox
                            checked={selectedStatuses.has("skipped")}
                            onCheckedChange={() => onToggleStatus("skipped")}
                        />
                        <FilterIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Filtered</span>
                    </div>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => onToggleStatus("awaiting_approval")}>
                        <Checkbox
                            checked={selectedStatuses.has("awaiting_approval")}
                            onCheckedChange={() => onToggleStatus("awaiting_approval")}
                        />
                        <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-sm">Awaiting Approval</span>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default StatusFilter;


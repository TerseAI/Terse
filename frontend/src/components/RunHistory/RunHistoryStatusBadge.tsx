import { CheckCircle2, XCircle, Loader2, Filter } from "lucide-react";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";

type Props = {
    status: RunHistoryStatus;
    filtered: boolean;
    className?: string;
};

export default function RunHistoryStatusBadge({ status, filtered: _filtered, className }: Props) {
    if (status === "skipped")
        return (
            <span className={className ?? "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border border-input text-foreground bg-transparent"}>
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                Filtered
            </span>
        );
    if (status === "success")
        return (
            <span className={className ?? "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded text-foreground border border-input bg-transparent"}>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                Success
            </span>
        );
    if (status === "failed")
        return (
            <span className={className ?? "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border border-input text-foreground bg-transparent"}>
                <XCircle className="w-3.5 h-3.5 text-destructive" />
                Failed
            </span>
        );
    if (status === "in_progress")
        return (
            <span className={className ?? "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border border-input text-foreground bg-transparent"}>
                <Loader2 className="w-3.5 h-3.5 text-accent" />
                In Progress
            </span>
        );
    return (
        <span className={className ?? "inline-flex items-center px-2 py-0.5 text-xs rounded border border-input text-foreground"}>
            Pending
        </span>
    );
}




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
            <span className={className ?? "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border border-[theme(border)] text-[theme(text-primary)] bg-transparent"}>
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                Filtered
            </span>
        );
    if (status === "success")
        return (
            <span className={className ?? "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded text-[theme(text-primary)] border border-[theme(border)] bg-transparent"}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Success
            </span>
        );
    if (status === "failed")
        return (
            <span className={className ?? "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border border-[theme(border)] text-[theme(text-primary)] bg-transparent"}>
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                Failed
            </span>
        );
    if (status === "in_progress")
        return (
            <span className={className ?? "inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border border-[theme(border)] text-[theme(text-primary)] bg-transparent"}>
                <Loader2 className="w-3.5 h-3.5 text-blue-400" />
                In Progress
            </span>
        );
    return (
        <span className={className ?? "inline-flex items-center px-2 py-0.5 text-xs rounded border border-[theme(border)] text-[theme(text-primary)]"}>
            Pending
        </span>
    );
}




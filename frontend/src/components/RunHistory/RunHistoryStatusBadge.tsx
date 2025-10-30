import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";

type Props = {
    status: RunHistoryStatus;
    filtered: boolean;
    className?: string;
};

export default function RunHistoryStatusBadge({ status, filtered, className }: Props) {
    if (filtered)
        return (
            <span className={className ?? "inline-flex items-center px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400 border border-slate-700"}>
                Filtered
            </span>
        );
    if (status === "success")
        return (
            <span className={className ?? "inline-flex items-center px-2 py-0.5 text-xs rounded text-[var(--color-accent)] border border-[var(--color-accent)]/40 bg-transparent"}>
                Success
            </span>
        );
    if (status === "failed")
        return (
            <span className={className ?? "inline-flex items-center px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20"}>
                Failed
            </span>
        );
    if (status === "in_progress")
        return (
            <span className={className ?? "inline-flex items-center px-2 py-0.5 text-xs rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"}>
                In Progress
            </span>
        );
    return (
        <span className={className ?? "inline-flex items-center px-2 py-0.5 text-xs rounded border border-slate-700 text-slate-400"}>
            Pending
        </span>
    );
}




import { CheckCircle2, XCircle, Clock, Filter as FilterIcon } from "lucide-react";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";

type Props = {
    status: RunHistoryStatus;
    filtered: boolean;
    className?: string;
};

export default function RunHistoryStatusIcon({ status, filtered, className }: Props) {
    if (filtered) return <FilterIcon className={className ?? "w-5 h-5 text-slate-400"} />;
    if (status === "success") return <CheckCircle2 className={className ?? "w-5 h-5 text-[var(--color-accent)]"} />;
    if (status === "failed") return <XCircle className={className ?? "w-5 h-5 text-red-400"} />;
    return <Clock className={className ?? "w-5 h-5 text-amber-500"} />;
}




import { CheckCircle2, XCircle, Filter, Clock } from "lucide-react";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Spinner } from "../ui/spinner";

type Props = {
    status: RunHistoryStatus;
    filtered: boolean;
    className?: string;
};

export default function RunHistoryStatusBadge({ status, filtered: _filtered, className }: Props) {
    if (status === "skipped")
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <Filter className="text-muted-foreground" />
                Filtered
            </Badge>
        );
    if (status === "success")
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <CheckCircle2 className="text-green-600 dark:text-green-400" />
                Success
            </Badge>
        );
    if (status === "failed")
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <XCircle className="text-destructive" />
                Failed
            </Badge>
        );
    if (status === "in_progress")
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <Spinner className="text-accent" />
                In Progress
            </Badge>
        );
    if (status === "awaiting_approval")
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <Clock className="text-yellow-600 dark:text-yellow-400" />
                Awaiting Approval
            </Badge>
        );
    return (
        <Badge variant="outline" className={className}>
            Unknown
        </Badge>
    );
}




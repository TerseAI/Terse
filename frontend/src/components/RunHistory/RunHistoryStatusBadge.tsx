import { CheckCircle2, Clock, Filter, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { RunHistoryStatus } from "../../shared/RunHistoryTypes"
import { Spinner } from "../ui/spinner"

type Props = {
    status: RunHistoryStatus
    filtered: boolean
    className?: string
}

export default function RunHistoryStatusBadge({ status, filtered: _filtered, className }: Props) {
    if (status === RunHistoryStatus.SKIPPED)
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <Filter className="text-muted-foreground" />
                Filtered
            </Badge>
        )
    if (status === RunHistoryStatus.SUCCESS)
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <CheckCircle2 className="text-green-600 dark:text-green-400" />
                Success
            </Badge>
        )
    if (status === RunHistoryStatus.FAILED)
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <XCircle className="text-destructive" />
                Failed
            </Badge>
        )
    if (status === RunHistoryStatus.IN_PROGRESS)
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <Spinner className="text-accent" />
                In Progress
            </Badge>
        )
    if (status === RunHistoryStatus.AWAITING_APPROVAL)
        return (
            <Badge variant="outline" className={cn("gap-1.5", className)}>
                <Clock className="text-yellow-600 dark:text-yellow-400" />
                Awaiting Approval
            </Badge>
        )
    return (
        <Badge variant="outline" className={className}>
            Unknown
        </Badge>
    )
}

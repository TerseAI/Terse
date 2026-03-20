import { Ban, CheckCircle2, Clock, Filter, XCircle } from "lucide-react"

import { RunHistoryStatus } from "../../shared/RunHistoryTypes"
import StatusBadge from "../StatusBadge"
import { Spinner } from "../ui/spinner"

type Props = {
    status: RunHistoryStatus
    className?: string
}

export default function RunHistoryStatusBadge({ status, className }: Props) {
    if (status === RunHistoryStatus.SKIPPED) return <StatusBadge text="Filtered" icon={Filter} className={className} status="success" />
    if (status === RunHistoryStatus.SUCCESS) return <StatusBadge text="Success" icon={CheckCircle2} className={className} status="success" />
    if (status === RunHistoryStatus.FAILED) return <StatusBadge text="Failed" icon={XCircle} className={className} status="error" />
    if (status === RunHistoryStatus.CANCELLED) return <StatusBadge text="Cancelled" icon={Ban} className={className} status="warning" />
    if (status === RunHistoryStatus.IN_PROGRESS) return <StatusBadge text="In Progress" iconComponent={<Spinner />} className={className} />
    if (status === RunHistoryStatus.AWAITING_APPROVAL) return <StatusBadge text="Awaiting Approval" icon={Clock} className={className} status="warning" />
    return <StatusBadge text="Unknown" className={className} />
}

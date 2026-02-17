import { Calendar as CalendarIcon, Database, FileText, MessageSquare, XCircle } from "lucide-react"

import { RunHistoryStatus } from "../../shared/RunHistoryTypes"

type Props = {
    actionType: string
    status: RunHistoryStatus
}

export default function ActionIcon({ actionType, status }: Props) {
    if (status === RunHistoryStatus.FAILED) return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />

    const type = actionType.toLowerCase()
    if (type.includes("database")) return <Database className="w-4 h-4 text-purple-400 flex-shrink-0" />
    if (type.includes("calendar")) return <CalendarIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
    if (type.includes("notification")) return <MessageSquare className="w-4 h-4 text-green-400 flex-shrink-0" />
    return <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
}

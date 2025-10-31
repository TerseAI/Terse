import { XCircle, Database, Calendar as CalendarIcon, MessageSquare, FileText } from "lucide-react";
import type { RunHistoryStatus } from "../../shared/RunHistoryTypes";

type Props = {
    actionType: string;
    status: RunHistoryStatus;
};

export default function ActionIcon({ actionType, status }: Props) {
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    
    const type = actionType.toLowerCase();
    if (type.includes("database")) return <Database className="w-4 h-4 text-purple-400 flex-shrink-0" />;
    if (type.includes("calendar")) return <CalendarIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    if (type.includes("notification")) return <MessageSquare className="w-4 h-4 text-green-400 flex-shrink-0" />;
    return <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />;
}


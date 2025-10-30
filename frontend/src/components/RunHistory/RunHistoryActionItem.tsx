import { ChevronRight, XCircle, Database, Calendar as CalendarIcon, MessageSquare, FileText, ExternalLink } from "lucide-react";
import type { RunHistoryAction, RunHistoryStatus } from "../../shared/RunHistoryTypes";

type Props = {
    runId: string;
    index: number;
    action: RunHistoryAction;
    runStatus: RunHistoryStatus;
    isExpanded: boolean;
    onToggle: (actionKey: string) => void;
};

export default function RunHistoryActionItem({ runId, index, action, runStatus, isExpanded, onToggle }: Props) {
    const actionKey = `${runId}-action-${index}`;

    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    const getActionIcon = (actionType: string, status: RunHistoryStatus) => {
        if (status === "failed") return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
        const type = actionType.toLowerCase();
        if (type.includes("database")) return <Database className="w-4 h-4 text-purple-400 flex-shrink-0" />;
        if (type.includes("calendar")) return <CalendarIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />;
        if (type.includes("notification"))
            return <MessageSquare className="w-4 h-4 text-green-400 flex-shrink-0" />;
        return <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    };

    return (
        <div className="bg-[#1a1a1a] rounded border border-slate-800">
            <button
                className="w-full text-left p-2 hover:bg-[#222222] transition-colors rounded"
                onClick={() => onToggle(actionKey)}
                type="button"
            >
                <div className="flex items-center gap-2">
                    {getActionIcon(action.action, runStatus)}
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-300">{capitalize(action.action)} on {capitalize(action.integration)} → {action.target}</span>
                            {action.url && (
                                <a
                                    href={action.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[var(--color-accent)] hover:opacity-80 transition-opacity"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                    }`} />
                </div>
            </button>
            {isExpanded && (
                <div className="px-2 pb-2 pt-1">
                    <div className="flex items-start gap-2 pl-6">
                        <div className={`flex-1 ${runStatus === "failed" ? "text-red-400" : "text-slate-400"}`}>
                            {action.details}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}




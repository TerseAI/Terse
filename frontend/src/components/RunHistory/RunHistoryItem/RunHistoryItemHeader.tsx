import { ChevronRight, Mail, ExternalLink, Copy } from "lucide-react";
import type { RunHistoryRecord } from "../../../shared/RunHistoryTypes";
import RunHistoryStatusIcon from "../RunHistoryStatusIcon";
import RunHistoryStatusBadge from "../RunHistoryStatusBadge";

type Props = {
    run: RunHistoryRecord;
    isExpanded: boolean;
    formattedTimestamp: string;
    onCopy: (text: string) => void;
};

export default function RunHistoryItemHeader({ run, isExpanded, formattedTimestamp, onCopy }: Props) {
    return (
        <div className="p-4 hover:bg-[#2a2a2a] transition-colors group">
            <div className="flex items-start gap-4">
                <div className="mt-0.5 flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    <RunHistoryStatusIcon status={run.status} filtered={run.filtered} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-white truncate">{run.trigger.title}</span>
                        <button
                            className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCopy(`Subject: ${run.trigger.title}\nFrom: ${run.trigger.subheader}`);
                            }}
                            type="button"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                        <span className="truncate">{run.trigger.subheader}</span>
                        <span>•</span>
                        <span className="flex-shrink-0">{formattedTimestamp}</span>
                        {run.trigger.url && (
                            <>
                                <span>•</span>
                                <a
                                    href={run.trigger.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0"><RunHistoryStatusBadge status={run.status} filtered={run.filtered} /></div>
            </div>
        </div>
    );
}



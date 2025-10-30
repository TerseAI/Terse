import { ChevronRight, CheckCircle2, Filter as FilterIcon, Copy } from "lucide-react";

type Props = {
    filtered: boolean;
    confidence: number;
    reasoning: string;
    isExpanded: boolean;
    onToggle: () => void;
    onCopy: (text: string) => void;
};

export default function RunHistoryItemDecision({ filtered, confidence, reasoning, isExpanded, onToggle, onCopy }: Props) {
    return (
        <div className="bg-[#1a1a1a] rounded border border-slate-800">
            <button
                className="w-full text-left p-2 hover:bg-[#222222] transition-colors rounded"
                onClick={onToggle}
                type="button"
            >
                <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                        {filtered ? (
                            <FilterIcon className="w-4 h-4 text-slate-400" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-300">
                                {filtered ? "Agent Decision: Skip" : "Agent Decision: Take Action"}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 text-xs rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {confidence}% confident
                            </span>
                        </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform mt-0.5 ${
                        isExpanded ? "rotate-90" : ""
                    }`} />
                </div>
            </button>
            {isExpanded && (
                <div className="px-2 pb-2 pt-1">
                    <div className="flex items-start gap-2 pl-6">
                        <div className="flex-1 text-slate-400">{reasoning}</div>
                        <button
                            className="h-6 w-6 p-0 text-slate-500 hover:text-slate-300"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCopy(reasoning);
                            }}
                            type="button"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}



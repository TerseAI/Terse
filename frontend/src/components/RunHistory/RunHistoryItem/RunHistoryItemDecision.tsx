import { ChevronRight, CheckCircle2, Filter as FilterIcon } from "lucide-react";

type Props = {
    filtered: boolean;
    reasoning: string;
    isExpanded: boolean;
    onToggle: () => void;
};

export default function RunHistoryItemDecision({ filtered, reasoning, isExpanded, onToggle }: Props) {
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
                                {filtered ? "Skip" : "Take Action"}
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
                    </div>
                </div>
            )}
        </div>
    );
}



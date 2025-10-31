import { ChevronRight, CheckCircle2, Filter as FilterIcon } from "lucide-react";

type Props = {
    filtered: boolean;
    reasoning: string;
    isExpanded: boolean;
    onToggle: () => void;
};

export default function RunHistoryItemDecision({ filtered, reasoning, isExpanded, onToggle }: Props) {
    return (
        <div className="bg-[theme(background)] rounded border border-[theme(border)]">
            <button
                className="w-full text-left p-2 hover:bg-[theme(background-hover)] transition-colors rounded"
                onClick={onToggle}
                type="button"
            >
                <div className="flex items-center gap-2">
                    <div>
                        {filtered ? (
                            <FilterIcon className="w-4 h-4 text-[theme(text-secondary)]" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[theme(text-primary)]">
                                {filtered ? "Skip" : "Take Action"}
                            </span>
                        </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-[theme(text-secondary)] transition-transform ${
                        isExpanded ? "rotate-90" : ""
                    }`} />
                </div>
            </button>
            {isExpanded && (
                <div className="px-2 pb-2 pt-1">
                    <div className="flex items-start gap-2 pl-6">
                        <div className="flex-1 text-[theme(text-secondary)]">{reasoning}</div>
                    </div>
                </div>
            )}
        </div>
    );
}



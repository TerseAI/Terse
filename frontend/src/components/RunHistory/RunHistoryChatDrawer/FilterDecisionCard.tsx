import { Filter as FilterIcon, CheckCircle2 } from 'lucide-react';

type Props = {
    filtered: boolean;
    decisionReasoning: string;
};

export default function FilterDecisionCard({ filtered, decisionReasoning }: Props) {
    const filterTitle = filtered ? 'Filtered: Skipped' : 'Filter Passed';
    const filterSubtitle = filtered ? 'Run stopped at filter stage' : 'Filter approved this run to execute';

    return (
        <div className="rounded-lg border border-border bg-muted/30">
            <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
                    {filtered ? (
                        <FilterIcon className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{filterTitle}</div>
                    <div className="text-xs text-muted-foreground">{filterSubtitle}</div>
                </div>
            </div>
            {decisionReasoning && (
                <div className="px-4 pb-3 text-sm text-muted-foreground whitespace-pre-wrap">
                    {decisionReasoning}
                </div>
            )}
        </div>
    );
}


import { RunHistoryRecord } from "../../../shared/RunHistoryTypes";
import RunHistoryActionItem from "../RunHistoryActionItem";
import RunHistoryItemHeader from "./RunHistoryItemHeader";
import RunHistoryItemDecision from "./RunHistoryItemDecision";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

type Props = {
    run: RunHistoryRecord;
    isExpanded: boolean;
    onToggleRun: (runId: string) => void;
    isDecisionExpanded: boolean;
    onToggleDecision: (runId: string) => void;
    isActionExpanded: (actionKey: string) => boolean;
    onToggleAction: (actionKey: string) => void;
    onToggleAllActionsForRun: (runId: string, actionCount: number) => void;
};

export default function RunHistoryItem({
    run,
    isExpanded,
    onToggleRun,
    isDecisionExpanded,
    onToggleDecision,
    isActionExpanded,
    onToggleAction,
    onToggleAllActionsForRun
}: Props) {
    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const copyToClipboard = (text: string) => {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
        }
    };

    const areAllActionsExpanded = (runId: string, actionCount: number) => {
        if (!actionCount) return false;
        const keys = Array.from({ length: actionCount }, (_, i) => `${runId}-action-${i}`);
        return keys.every((k) => isActionExpanded(k));
    };

    const allActionsExpanded = !!run.actions && areAllActionsExpanded(run.id, run.actions.length);

    return (
        <div className="overflow-hidden bg-[theme(background-light)] border border-[theme(border)] rounded-lg md:mb-3 min-w-[640px] md:min-w-0 shrink-0 md:shrink">
            <Accordion
                type="single"
                collapsible

                value={isExpanded ? run.id : ""}
                onValueChange={() => {
                    onToggleRun(run.id);
                }}
            >
                <AccordionItem value={run.id} className="border-0">
                    <AccordionTrigger className="hover:no-underline p-0 w-full [&>svg]:hidden"> 
                        <RunHistoryItemHeader
                            run={run}
                            isExpanded={isExpanded}
                            formattedTimestamp={formatTimestamp(run.timestamp)}
                            onCopy={copyToClipboard}
                        />
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-0">
                        <div className="text-[theme(text-primary)] pl-8">
                            Agent Decision:
                        </div>
                        <div className="mt-3 pl-8">
                            <RunHistoryItemDecision
                                filtered={run.filtered}
                                reasoning={run.decision.reasoning}
                                isExpanded={isDecisionExpanded}
                                onToggle={() => onToggleDecision(run.id)}
                            />
                        </div>

                        {run.actions && run.actions.length > 0 && (
                            <div className="mt-3 pl-8">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[theme(text-primary)]">
                                        {run.status === "failed" ? "Error Details:" : `Actions Taken (${run.actions.length}):`}
                                    </div>
                                    {run.actions.length > 1 && (
                                        <button
                                            className="h-7 px-2 rounded-md text-sm text-[theme(text-secondary)] hover:text-[theme(text-primary)] hover:bg-[theme(background-hover)] border border-transparent hover:border-[theme(border)]"
                                            onClick={() => onToggleAllActionsForRun(run.id, run.actions!.length)}
                                            type="button"
                                        >
                                            {allActionsExpanded ? "Collapse All" : "Expand All"}
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {run.actions.map((action, idx) => {
                                        const actionKey = `${run.id}-action-${idx}`;
                                        return (
                                            <RunHistoryActionItem
                                                key={actionKey}
                                                runId={run.id}
                                                index={idx}
                                                action={action}
                                                runStatus={run.status}
                                                isExpanded={isActionExpanded(actionKey)}
                                                onToggle={onToggleAction}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}



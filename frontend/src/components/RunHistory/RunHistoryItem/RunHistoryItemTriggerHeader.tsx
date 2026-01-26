import { ExternalLink, Copy, CheckCircle, XCircle } from "lucide-react";
import type { RunHistoryTrigger } from "../../../shared/RunHistoryTypes";
import { IconForIntegration } from "../../../pages/Agents/components/Integration";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { FilterResult } from "../../../shared/ModelEvents";


type Props = {
    trigger: RunHistoryTrigger;
    formattedTimestamp?: string;
    onCopy?: (text: string) => void;
    onClick?: (index: number) => void;
    index?: number;
    selected?: boolean;
    filterResult?: FilterResult;
};

export default function RunHistoryItemHeader({ trigger, formattedTimestamp, onCopy, onClick, index, selected, filterResult }: Props) {
    const title = trigger.title || trigger.source;

    return (
        <div className={`group w-full min-w-0 no-underline hover:no-underline ${onClick ? 'cursor-pointer hover:bg-muted rounded-md p-1' : ''} ${selected ? 'bg-muted rounded-md p-1' : ''}`} onClick={() => onClick?.(index ?? 0)}>
            <div className="flex items-start gap-3 min-w-0">
                <div className="text-muted-foreground size-4 flex-shrink-0 mt-1">
                    <IconForIntegration integration={trigger.integration} />
                </div>
                <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                    <div className="flex items-center gap-2 mb-1 min-w-0 max-w-full">
                        <span
                            className="text-foreground truncate no-underline hover:no-underline block min-w-0 max-w-full"
                            title={title}
                        >
                            {title}
                        </span>
                        {filterResult !== undefined && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="flex-shrink-0">
                                            {filterResult.isRelevant ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-red-500" />
                                            )}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <div className="text-sm">
                                            <div className="font-medium mb-1">
                                                {filterResult.isRelevant ? 'Would trigger agent' : 'Would be filtered out'}
                                            </div>
                                            <div className="text-muted-foreground">{filterResult.reason}</div>
                                            <div className="text-xs mt-1 text-muted-foreground">
                                                Confidence: {Math.round(filterResult.confidence * 100)}%
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {trigger.url && (
                            <a
                                href={trigger.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-foreground flex-shrink-0"
                            >
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        {onCopy && (
                        <button
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCopy(title ?? "");
                            }}
                            type="button"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground no-underline hover:no-underline min-w-0 max-w-full">
                        {trigger.subheader && (
                            <>
                                <span
                                    className="truncate no-underline hover:no-underline block min-w-0 max-w-full"
                                    title={trigger.subheader}
                                >
                                    {trigger.subheader}
                                </span>
                                <span className="no-underline hover:no-underline flex-shrink-0">•</span>
                            </>
                        )}
                        {formattedTimestamp && (
                            <span className="flex-shrink-0 no-underline hover:no-underline">{formattedTimestamp}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
import { ExternalLink, Copy } from "lucide-react";
import type { RunHistoryRecord } from "../../../shared/RunHistoryTypes";
import RunHistoryStatusBadge from "../RunHistoryStatusBadge";
import { IconForIntegration } from "../../../pages/Channels/components/Integration";

type Props = {
    run: RunHistoryRecord;
    isExpanded: boolean;
    formattedTimestamp: string;
    onCopy: (text: string) => void;
};

export default function RunHistoryItemHeader({ run, formattedTimestamp, onCopy }: Props) {
    return (
        <div className="group w-full no-underline hover:no-underline">
            <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="text-muted-foreground size-4 flex-shrink-0">
                            <IconForIntegration integration={run.trigger.integration} />
                        </div>
                        <span 
                            className="text-foreground truncate no-underline hover:no-underline max-w-[780px]" 
                            title={run.trigger.title}
                        >
                            {run.trigger.title}
                        </span>
                        {run.trigger.url && (
                            <a
                                href={run.trigger.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-foreground flex-shrink-0"
                            >
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        <button
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCopy(run.trigger.title ?? "");
                            }}
                            type="button"
                        >
                            <Copy className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground no-underline hover:no-underline">
                        <span 
                            className="truncate no-underline hover:no-underline" 
                            title={run.trigger.subheader}
                        >
                            {run.trigger.subheader}
                        </span>
                        <span className="no-underline hover:no-underline">•</span>
                        <span className="flex-shrink-0 no-underline hover:no-underline">{formattedTimestamp}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0"><RunHistoryStatusBadge status={run.status} filtered={run.filtered} /></div>
            </div>
        </div>
    );
}



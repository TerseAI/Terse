import { ExternalLink } from "lucide-react";
import { RunHistoryAction } from "../../../shared/RunHistoryTypes";
import { IconForIntegration } from "../../Channels/components/Integration";

export interface ActionItemProps {
    action: RunHistoryAction & { timestamp: string; channelName: string };
}

export function ActionItem({ action }: ActionItemProps) {
    return (
        <div className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
            <div className="mt-0.5">
                <div className="w-8 h-8 flex items-center justify-center rounded bg-muted/50">
                    <IconForIntegration integration={action.integration} />
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{action.action}</p>
                        {action.url && (
                            <a
                                href={action.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:opacity-80 transition-opacity"
                            >
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {action.timestamp}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                    {action.channelName} • {action.details}
                </p>
            </div>
        </div>
    );
}


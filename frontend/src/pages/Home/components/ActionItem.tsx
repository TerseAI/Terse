import { RunHistoryAction } from "../../../shared/RunHistoryTypes";
import { IconForIntegration } from "../../Automations/components/Integration";

export interface ActionItemProps {
    action: RunHistoryAction & { timestamp: string; automationName: string };
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
                    <p className="text-sm font-medium">{action.action}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {action.timestamp}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                    {action.automationName} • {action.details}
                </p>
            </div>
        </div>
    );
}


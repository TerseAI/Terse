import { formatTimestamp, getFullTimestamp } from './utils';
import type { ToolApprovalRequest } from '@/shared/ModelEvents';

type Props = {
    approvalEvent: ToolApprovalRequest;
    timestamp?: string;
    stepId: string;
};

export default function ApprovalEvent({ approvalEvent, timestamp, stepId }: Props) {
    return (
        <div key={`approval-${stepId}`} className="mb-4 select-text">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="mb-1">
                        <div className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                            Approval Required: {approvalEvent.name}
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                        {approvalEvent.arguments}
                    </div>
                </div>
                {timestamp && (
                    <div className="text-xs text-muted-foreground flex-shrink-0 px-4" title={getFullTimestamp(timestamp)}>
                        {formatTimestamp(timestamp)}
                    </div>
                )}
            </div>
        </div>
    );
}


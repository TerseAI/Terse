import { useState } from "react";
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { FunctionCallEvent } from "./Turn";
import FunctionCallItem from "./FunctionCallItem";

interface ToolCallsSummaryProps {
    calls: FunctionCallEvent[];
    isTurnFailure?: boolean;
    onApprove?: (stepId: string) => void;
    onReject?: (stepId: string) => void;
}

export default function ToolCallsSummary({ calls, isTurnFailure = false, onApprove, onReject }: ToolCallsSummaryProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (calls.length === 0) return null;

    const isAnyRunning = calls.some(c => c.isRunning);
    const hasAnyWaitingForApproval = calls.some(c => c.isWaitingForApproval && !c.isRejected);

    // Auto-expand if any call is waiting for approval
    const shouldShowExpanded = isExpanded || hasAnyWaitingForApproval;

    return (
        <div className="w-fit">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
                <ChevronRightIcon
                    className={`w-3 h-3 transition-transform duration-200 ${shouldShowExpanded ? 'rotate-90' : ''}`}
                />
                {isAnyRunning ? (
                    <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : null}
                <span>
                    {calls.length} tool call{calls.length !== 1 ? 's' : ''}
                    {hasAnyWaitingForApproval && (
                        <span className="text-yellow-500 ml-1">(approval needed)</span>
                    )}
                </span>
            </button>

            {shouldShowExpanded && (
                <div className="ml-4 mt-2 space-y-2">
                    {calls.map((call, index) => (
                        <FunctionCallItem
                            key={`${call.id}-${index}`}
                            call={call}
                            index={index}
                            isTurnFailure={isTurnFailure}
                            onApprove={onApprove}
                            onReject={onReject}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

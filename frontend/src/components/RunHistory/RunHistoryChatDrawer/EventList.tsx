import type { ModelEvent } from '@/shared/ModelEvents';
import { RunHistoryStatus } from '@/shared/RunHistoryTypes';
import TextMessage from './TextMessage';
import ToolCallEvent from './ToolCallEvent';
import ApprovalEvent from './ApprovalEvent';
import FailureEvent from './FailureEvent';
import FilterResultEvent from './FilterResultEvent';
import type { MessageOrderItem, ToolCallData } from './useChatEvents';

type Props = {
    events: Array<ModelEvent & { timestamp?: string }>;
    messageOrder: MessageOrderItem[];
    toolCallMap: Map<string, ToolCallData>;
    accumulatedMessages: Map<string, string>;
    expandedToolCalls: Set<string>;
    onToggleToolCall: (stepId: string, expanded: boolean) => void;
    isLoading: boolean;
    status: RunHistoryStatus;
    isActiveRun?: boolean;
};

export default function EventList({
    events,
    messageOrder,
    toolCallMap,
    accumulatedMessages,
    expandedToolCalls,
    onToggleToolCall,
    isLoading,
    status,
    isActiveRun = false,
}: Props) {
    if (isLoading) {
        return <div className="py-8 text-center text-muted-foreground">Loading chat history...</div>;
    }

    if (events.length === 0) {
        return <div className="py-8 text-center text-muted-foreground">No chat events yet</div>;
    }

    // Find FilterResult event once for reuse
    const filterResultEvent = events.find((e) => e.type === 'FilterResult') as { type: 'FilterResult'; isRelevant: boolean; reason: string; confidence: number; timestamp?: string } | undefined;

    return (
        <>
            {messageOrder.map((item, index) => {
                const timestamp = item.timestamp;

                if (item.type === 'text') {
                    const text = accumulatedMessages.get(item.stepId) || '';
                    return (
                        <div key={`${item.stepId}-${index}`}>
                            <TextMessage text={text} timestamp={timestamp} stepId={item.stepId} />
                        </div>
                    );
                }

                if (item.type === 'tool') {
                    const toolCallData = toolCallMap.get(item.stepId);
                    if (!toolCallData) return null;
                    return (
                        <div key={`${item.stepId}-${index}`}>
                            <ToolCallEvent
                                toolCallData={toolCallData}
                                stepId={item.stepId}
                                isExpanded={expandedToolCalls.has(item.stepId)}
                                onToggleExpand={onToggleToolCall}
                                status={status}
                            />
                        </div>
                    );
                }

                if (item.type === 'approval') {
                    const approvalEvent = events.find((e) => {
                        if (e.type === 'ToolApprovalRequest' && e.step_id === item.stepId) {
                            return true;
                        }
                        return false;
                    });
                    if (approvalEvent?.type === 'ToolApprovalRequest') {
                        return (
                            <div key={`${item.stepId}-${index}`}>
                                <ApprovalEvent
                                    approvalEvent={approvalEvent}
                                    timestamp={timestamp}
                                    stepId={item.stepId}
                                />
                            </div>
                        );
                    }
                }

                // Skip stop events - don't display "Agent completed" messages
                if (item.type === 'stop') {
                    return null;
                }

                if (item.type === 'filter') {
                    if (filterResultEvent) {
                        return (
                            <div key={`${item.stepId}-${index}`}>
                                <FilterResultEvent filterResult={filterResultEvent} />
                            </div>
                        );
                    }
                }

                if (item.type === 'failure') {
                    const failureEvent = events.find((e) => e.type === 'Failure') as { type: 'Failure'; error: string; timestamp?: string } | undefined;
                    if (failureEvent) {
                        return (
                            <div key={`${item.stepId}-${index}`}>
                                <FailureEvent failureEvent={failureEvent} />
                            </div>
                        );
                    }
                }

                return null;
            })}
            {isActiveRun && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 py-4 px-4 text-sm text-muted-foreground">
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span>Waiting for more messages...</span>
                    </div>
                </div>
            )}
        </>
    );
}


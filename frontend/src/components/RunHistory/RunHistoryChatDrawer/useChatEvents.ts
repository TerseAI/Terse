import { useMemo } from 'react';
import type { ModelEvent } from '@/shared/ModelEvents';

export type MessageOrderItem = {
    stepId: string;
    type: 'TextDelta' | 'ToolCall' | 'ToolApprovalRequest' | 'NaturalStop' | 'Failure' | 'FilterResult';
    timestamp?: string;
};

export type ToolCallData = {
    toolCall?: { type: 'ToolCall'; summary: string; step_id: string; parameters: string; integration: string; timestamp?: string };
    toolComplete?: { type: 'ToolCallComplete'; tool_name: string; status: string; step_id: string; changed_items: any[]; integration: string; timestamp?: string };
    firstSeenIndex: number;
};

export function useChatEvents(events: Array<ModelEvent & { timestamp?: string }>) {
    return useMemo(() => {
        // Accumulate text deltas by step_id
        const accumulatedMessages = new Map<string, string>();
        
        // Track tool calls and completions together
        const toolCallMap = new Map<string, ToolCallData>();
        
        const messageOrder: MessageOrderItem[] = [];

        events.forEach((event, index) => {
            // FilterResult should appear first
            if (event.type === 'FilterResult') {
                if (!messageOrder.find((m) => m.stepId === 'filter' && m.type === 'FilterResult')) {
                    messageOrder.unshift({ 
                        stepId: 'filter', 
                        type: 'FilterResult',
                        timestamp: (event as any).timestamp,
                    });
                }
            } else if (event.type === 'TextDelta') {
                const current = accumulatedMessages.get(event.step_id) || '';
                accumulatedMessages.set(event.step_id, current + event.delta);
                if (!messageOrder.find((m) => m.stepId === event.step_id && m.type === 'TextDelta')) {
                    messageOrder.push({ 
                        stepId: event.step_id, 
                        type: 'TextDelta',
                        timestamp: (event as any).timestamp,
                    });
                }
            } else if (event.type === 'ToolCall') {
                if (!toolCallMap.has(event.step_id)) {
                    toolCallMap.set(event.step_id, { firstSeenIndex: index });
                    messageOrder.push({ 
                        stepId: event.step_id, 
                        type: 'ToolCall',
                        timestamp: (event as any).timestamp,
                    });
                }
                const toolCallData = toolCallMap.get(event.step_id)!;
                toolCallData.toolCall = {
                    ...event,
                    timestamp: (event as any).timestamp,
                };
            } else if (event.type === 'ToolCallComplete') {
                if (!toolCallMap.has(event.step_id)) {
                    toolCallMap.set(event.step_id, { firstSeenIndex: index });
                    messageOrder.push({ 
                        stepId: event.step_id, 
                        type: 'ToolCall',
                        timestamp: (event as any).timestamp,
                    });
                }
                const toolCallData = toolCallMap.get(event.step_id)!;
                toolCallData.toolComplete = {
                    ...event,
                    timestamp: (event as any).timestamp,
                };
            } else if (event.type === 'ToolApprovalRequest') {
                messageOrder.push({ 
                    stepId: event.step_id, 
                    type: 'ToolApprovalRequest',
                    timestamp: (event as any).timestamp,
                });
            } else if (event.type === 'NaturalStop') {
                messageOrder.push({ 
                    stepId: 'stop', 
                    type: 'NaturalStop',
                    timestamp: (event as any).timestamp,
                });
            } else if (event.type === 'Failure') {
                messageOrder.push({ 
                    stepId: 'failure', 
                    type: 'Failure',
                    timestamp: (event as any).timestamp,
                });
            }
        });

        return {
            accumulatedMessages,
            toolCallMap,
            messageOrder,
        };
    }, [events]);
}


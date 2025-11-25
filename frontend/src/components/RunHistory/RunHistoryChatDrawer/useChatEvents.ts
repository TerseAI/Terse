import { useMemo } from 'react';
import type { ModelEvent } from '@/shared/ModelEvents';

export type MessageOrderItem = {
    stepId: string;
    type: 'text' | 'tool' | 'approval' | 'stop' | 'failure' | 'filter';
};

export type ToolCallData = {
    toolCall?: { type: 'ToolCall'; summary: string; step_id: string; parameters: string; timestamp?: string };
    toolComplete?: { type: 'ToolCallComplete'; tool_name: string; status: string; step_id: string; changed_items: any[]; timestamp?: string };
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
                if (!messageOrder.find((m) => m.stepId === 'filter' && m.type === 'filter')) {
                    messageOrder.unshift({ stepId: 'filter', type: 'filter' });
                }
            } else if (event.type === 'TextDelta') {
                const current = accumulatedMessages.get(event.step_id) || '';
                accumulatedMessages.set(event.step_id, current + event.delta);
                if (!messageOrder.find((m) => m.stepId === event.step_id && m.type === 'text')) {
                    messageOrder.push({ stepId: event.step_id, type: 'text' });
                }
            } else if (event.type === 'ToolCall') {
                if (!toolCallMap.has(event.step_id)) {
                    toolCallMap.set(event.step_id, { firstSeenIndex: index });
                    messageOrder.push({ stepId: event.step_id, type: 'tool' });
                }
                const toolCallData = toolCallMap.get(event.step_id)!;
                toolCallData.toolCall = {
                    ...event,
                    timestamp: (event as any).timestamp,
                };
            } else if (event.type === 'ToolCallComplete') {
                if (!toolCallMap.has(event.step_id)) {
                    toolCallMap.set(event.step_id, { firstSeenIndex: index });
                    messageOrder.push({ stepId: event.step_id, type: 'tool' });
                }
                const toolCallData = toolCallMap.get(event.step_id)!;
                toolCallData.toolComplete = {
                    ...event,
                    timestamp: (event as any).timestamp,
                };
            } else if (event.type === 'ToolApprovalRequest') {
                messageOrder.push({ stepId: event.step_id, type: 'approval' });
            } else if (event.type === 'NaturalStop') {
                messageOrder.push({ stepId: 'stop', type: 'stop' });
            } else if (event.type === 'Failure') {
                messageOrder.push({ stepId: 'failure', type: 'failure' });
            }
        });

        return {
            accumulatedMessages,
            toolCallMap,
            messageOrder,
        };
    }, [events]);
}


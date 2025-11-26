import { useMemo } from 'react';
import type { ModelEvent, ToolCall, ToolCallComplete } from '@/shared/ModelEvents';

export type MessageOrderItem = {
    stepId: string;
    type: 'TextDelta' | 'ToolCall' | 'ToolApprovalRequest' | 'NaturalStop' | 'Failure' | 'FilterResult';
    timestamp?: string;
};

export type ToolCallData = {
    toolCall?: ToolCall & { timestamp?: string };
    toolComplete?: ToolCallComplete & { timestamp?: string };
    firstSeenIndex: number;
};

export function useChatEvents(events: Array<ModelEvent & { timestamp?: string }>) {
    return useMemo(() => {
        // Accumulate text deltas by step_id
        // - Websocket during active runs: many small deltas → accumulate here
        // - API after completion: already complete messages → still accumulate for consistency
        const accumulatedMessages = new Map<string, string>();
        
        // Track tool calls and completions together
        const toolCallMap = new Map<string, ToolCallData>();
        
        // Maintain display order of all events
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
                // Accumulate deltas: "Hello" + " world" → "Hello world"
                // Backend stores complete deltas, but websocket streams them piece by piece
                const current = accumulatedMessages.get(event.step_id) || '';
                accumulatedMessages.set(event.step_id, current + event.delta);
                
                // Add to message order only once per step_id
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


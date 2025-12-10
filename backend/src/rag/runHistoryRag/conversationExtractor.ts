import type { AgentInputItem } from '@openai/agents-core';

/**
 * Extracts searchable text content from AgentInputItem conversation events.
 * This preserves the semantic meaning of conversations for embedding.
 */
export function extractConversationContent(event: AgentInputItem): string {
    const eventAny = event as any;

    // User/Assistant messages - extract the text content
    if (eventAny.role === 'user' || eventAny.role === 'assistant') {
        if (typeof eventAny.content === 'string') {
            return eventAny.content;
        }
        
        // Handle array content (multimodal - text and images)
        if (Array.isArray(eventAny.content)) {
            return eventAny.content
                .filter((part: any) => part.type === 'text')
                .map((part: any) => part.text || '')
                .join(' ');
        }
        
        // Fallback for structured content
        if (typeof eventAny.content === 'object') {
            return JSON.stringify(eventAny.content);
        }
    }

    // Tool/function calls - include function name and arguments for context
    if (eventAny.type === 'function_call' || eventAny.function) {
        const funcName = eventAny.function?.name || eventAny.name || '';
        const args = eventAny.function?.arguments || eventAny.arguments || {};
        const argsStr = typeof args === 'string' ? args : JSON.stringify(args);
        return `Tool call: ${funcName} with arguments: ${argsStr}`;
    }

    // Tool/function results - include the result for context
    if (eventAny.type === 'function_result' || eventAny.role === 'tool') {
        const result = eventAny.content || eventAny.result || '';
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
        return `Tool result: ${resultStr}`;
    }

    // Reasoning items
    if (eventAny.type === 'reasoning' || eventAny.id?.startsWith('rs_')) {
        return eventAny.content || eventAny.reasoning || '';
    }

    // System messages
    if (eventAny.role === 'system') {
        return typeof eventAny.content === 'string' 
            ? eventAny.content 
            : JSON.stringify(eventAny.content || {});
    }

    // Fallback: stringify the whole event
    return JSON.stringify(event);
}

/**
 * Extract a conversation context window around an event.
 * Useful for creating richer searchable content that includes surrounding context.
 */
export function extractConversationWithContext(
    events: AgentInputItem[],
    eventIndex: number,
    contextWindow: number = 2
): string {
    const start = Math.max(0, eventIndex - contextWindow);
    const end = Math.min(events.length, eventIndex + contextWindow + 1);
    const contextEvents = events.slice(start, end);
    
    return contextEvents
        .map((event, idx) => {
            const content = extractConversationContent(event);
            const role = (event as any).role || 'unknown';
            return `[${role}]: ${content}`;
        })
        .join('\n');
}
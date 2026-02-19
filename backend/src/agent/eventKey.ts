import type { AgentInputItem, FunctionCallItem } from "@openai/agents-core"

export function getEventKey(event: AgentInputItem): string {
    const eventId = event.id
    const eventType = event.type
    const callId = (event as FunctionCallItem)?.callId

    // For tool calls
    if (callId) {
        return `${eventType}:callId:${callId}`
    }

    return `id:${eventId}`
}

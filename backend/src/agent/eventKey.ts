import type { AgentInputItem, AssistantMessageItem, FunctionCallItem, SystemMessageItem, UserMessageItem } from "@openai/agents-core"

import { md5Hash } from "../services/FileStorageService"

export function getEventKey(event: AgentInputItem): string | null {
    // Some events returned have an id property, use that by default
    const eventId = event?.id
    const eventType = event?.type
    const role = (event as UserMessageItem | AssistantMessageItem | SystemMessageItem)?.role
    const callId = (event as FunctionCallItem)?.callId
    const content = (event as UserMessageItem | AssistantMessageItem | SystemMessageItem)?.content

    // Basic use case works for hosted tools AND messages from bot
    if (eventId) {
        return `id:${eventId}`
    }

    // For tool calls
    if (callId) {
        return `${eventType}:callId:${callId}`
    }

    // Fallback to type + role and md5 hash of payload
    if (eventType && role) {
        return `${eventType}:${role}:${md5Hash(JSON.stringify(content))}`
    }
    return null
}

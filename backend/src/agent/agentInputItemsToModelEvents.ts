import type { AgentInputItem, AssistantMessageItem, FunctionCallItem, FunctionCallResultItem, ReasoningItem, UserMessageItem } from "@openai/agents-core"

import { IntegrationType } from "../shared/Integrations"
import { ModelEvent } from "../shared/ModelEvents"

import { parseToolExecutionResult } from "./toolExecution"

/** An AgentInputItem paired with the DB timestamp it was created at. */
export type TimestampedAgentInputItem = {
    item: AgentInputItem
    createdAt: Date | null
}

export function convertAgentInputItemsToModelEvents(items: (AgentInputItem | TimestampedAgentInputItem)[], toolToIntegrationMap?: Map<string, string>): ModelEvent[] {
    const events: ModelEvent[] = []
    let lastTimestamp: Date | null | undefined

    for (const entry of items) {
        const isTimestamped = typeof entry === "object" && entry !== null && "item" in entry && "createdAt" in entry
        const item: AgentInputItem = isTimestamped ? (entry as TimestampedAgentInputItem).item : (entry as AgentInputItem)
        const ts = isTimestamped ? (entry as TimestampedAgentInputItem).createdAt : undefined
        if (ts) lastTimestamp = ts

        const converted = convertSingleItem(item, toolToIntegrationMap)
        if (converted) {
            for (const event of converted) {
                events.push(ts ? { ...event, timestamp: ts.getTime() } : event)
            }
        }
    }

    // Add a NaturalStop if there are any events and no ending marker
    if (events.length > 0) {
        const lastEvent = events[events.length - 1]
        if (lastEvent.type !== "NaturalStop" && lastEvent.type !== "Failure") {
            events.push({
                type: "NaturalStop",
                step_id: "historical-stop",
                ...(lastTimestamp ? { timestamp: lastTimestamp.getTime() } : {})
            })
        }
    }

    return events
}

function convertSingleItem(item: AgentInputItem, toolToIntegrationMap?: Map<string, string>): ModelEvent[] | null {
    // User message
    if (isUserMessageItem(item)) {
        const text = extractTextFromMessageContent(item.content)
        if (text) {
            return [{ type: "UserMessage", message: text }]
        }
        return null
    }

    // Assistant message - convert to TextDelta events
    if (isAssistantMessageItem(item)) {
        const text = extractTextFromMessageContent(item.content)
        if (text) {
            const stepId = item.id || "assistant-msg"
            return [
                {
                    type: "TextDelta",
                    delta: text,
                    step_id: stepId
                }
            ]
        }
        return null
    }

    // Reasoning items - convert to Thinking events
    if (isReasoningItem(item)) {
        const stepId = item.id || "reasoning"
        return [
            {
                type: "Thinking",
                step_id: stepId
            }
        ]
    }

    // Function call - convert to ToolCall
    if (isFunctionCallItem(item)) {
        const integration = toolToIntegrationMap?.get(item.name) || IntegrationType.TERSE
        return [
            {
                type: "ToolCall",
                summary: item.name,
                step_id: item.callId || item.id || "unknown",
                parameters: item.arguments || "{}",
                integration
            }
        ]
    }

    // Function call result - convert to ToolCallComplete
    if (isFunctionCallResultItem(item)) {
        const integration = toolToIntegrationMap?.get(item.name || "") || IntegrationType.TERSE
        const parsed = parseToolExecutionResult(item.output, item.status)

        return [
            {
                type: "ToolCallComplete",
                tool_name: item.name || "unknown",
                status: parsed.status,
                step_id: item.callId || item.id || "unknown",
                changed_items: [], // Historical events don't have changed_items tracked
                integration,
                result: parsed.outputString || undefined,
                ...(parsed.errorContext ? { errorContext: { error: parsed.errorContext.error } } : {})
            }
        ]
    }

    return null
}

// Type guards
function isUserMessageItem(event: AgentInputItem): event is UserMessageItem {
    return typeof event === "object" && event !== null && "role" in event && event.role === "user"
}

function isAssistantMessageItem(event: AgentInputItem): event is AssistantMessageItem {
    return typeof event === "object" && event !== null && "role" in event && event.role === "assistant"
}

function isFunctionCallItem(event: AgentInputItem): event is FunctionCallItem {
    return typeof event === "object" && event !== null && "type" in event && event.type === "function_call"
}

function isFunctionCallResultItem(event: AgentInputItem): event is FunctionCallResultItem {
    return typeof event === "object" && event !== null && "type" in event && event.type === "function_call_result"
}

function isReasoningItem(event: AgentInputItem): event is ReasoningItem {
    if (typeof event !== "object" || event === null) return false

    if ("type" in event && event.type === "reasoning") return true

    // Check for reasoning items by ID pattern (rs_ prefix)
    if ("id" in event && typeof event.id === "string" && event.id.startsWith("rs_")) {
        return true
    }

    return false
}

// Content extraction helpers
function extractTextFromMessageContent(content: UserMessageItem["content"] | AssistantMessageItem["content"]): string {
    if (typeof content === "string") {
        return content
    }

    if (Array.isArray(content)) {
        return content
            .filter((part): part is { type: "input_text" | "output_text"; text: string } => (part.type === "input_text" || part.type === "output_text") && "text" in part)
            .map(part => part.text)
            .join(" ")
    }

    return ""
}

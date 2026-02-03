import type { AgentInputItem, AssistantMessageItem, FunctionCallItem, FunctionCallResultItem, ReasoningItem, UserMessageItem } from "@openai/agents-core"

import { IntegrationType } from "../shared/Integrations"
import { ModelEvent } from "../shared/ModelEvents"

export function convertAgentInputItemsToModelEvents(items: AgentInputItem[], toolToIntegrationMap?: Map<string, string>): ModelEvent[] {
    const events: ModelEvent[] = []

    for (const item of items) {
        const converted = convertSingleItem(item, toolToIntegrationMap)
        if (converted) {
            events.push(...converted)
        }
    }

    // Add a NaturalStop if there are any events and no ending marker
    if (events.length > 0) {
        const lastEvent = events[events.length - 1]
        if (lastEvent.type !== "NaturalStop" && lastEvent.type !== "Failure") {
            events.push({ type: "NaturalStop", step_id: "historical-stop" })
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
        const output = extractTextFromFunctionResultOutput(item.output)
        const hasError = item.status === "incomplete"

        return [
            {
                type: "ToolCallComplete",
                tool_name: item.name || "unknown",
                status: item.status || "completed",
                step_id: item.callId || item.id || "unknown",
                changed_items: [], // Historical events don't have changed_items tracked
                integration,
                result: output || undefined,
                ...(hasError ? { errorContext: { error: output || `Tool failed with status: ${item.status}` } } : {})
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

function extractTextFromFunctionResultOutput(output: FunctionCallResultItem["output"]): string | null {
    if (typeof output === "string") {
        return output
    }

    if (typeof output === "object" && output !== null) {
        if ("type" in output && output.type === "text" && "text" in output) {
            return output.text
        }
        // For other object types, try to stringify (may be helpful for debugging)
        try {
            return JSON.stringify(output)
        } catch {
            return null
        }
    }

    return null
}

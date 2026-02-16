import type { AgentInputItem, AssistantMessageItem, FunctionCallItem, FunctionCallResultItem, ReasoningItem, UserMessageItem } from "@openai/agents-core"

import { IntegrationType } from "../shared/Integrations"
import { ModelEvent } from "../shared/ModelEvents"

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
        const actualOutput = normalizeFunctionResultOutput(item.output)
        const output = stringifyFunctionResultOutput(actualOutput)
        const structuredFailure = extractStructuredFailure(actualOutput)
        const hasStatusError = item.status === "incomplete"
        const hasSerializedError = typeof output === "string" && isSerializedToolError(output)
        const hasError = hasStatusError || hasSerializedError || Boolean(structuredFailure)
        const errorMessage =
            structuredFailure?.error ??
            (hasSerializedError && output ? parseSerializedToolError(output) : output || `Tool failed with status: ${item.status}`)

        return [
            {
                type: "ToolCallComplete",
                tool_name: item.name || "unknown",
                status: item.status || "completed",
                step_id: item.callId || item.id || "unknown",
                changed_items: [], // Historical events don't have changed_items tracked
                integration,
                result: output || undefined,
                ...(hasError ? { errorContext: { error: errorMessage } } : {})
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

function normalizeFunctionResultOutput(output: FunctionCallResultItem["output"]): unknown {
    if (typeof output === "string") {
        try {
            return JSON.parse(output)
        } catch {
            return output
        }
    }

    if (typeof output === "object" && output !== null) {
        if ("type" in output && output.type === "text" && "text" in output && typeof output.text === "string") {
            try {
                return JSON.parse(output.text)
            } catch {
                return output.text
            }
        }
        return output
    }

    return output
}

function stringifyFunctionResultOutput(output: unknown): string | null {
    if (typeof output === "string") {
        return output
    }

    if (output === null || output === undefined) {
        return null
    }

    try {
        return JSON.stringify(output)
    } catch {
        return null
    }
}

type StructuredFailure = { error: string | unknown }

function extractStructuredFailure(output: unknown): StructuredFailure | undefined {
    if (!output || typeof output !== "object") {
        return undefined
    }

    const candidate = output as Record<string, unknown>
    const explicitlyFailed = candidate.success === false || candidate.ok === false
    if (!explicitlyFailed) {
        return undefined
    }

    const rawError = candidate.error ?? candidate.message ?? "Tool returned success=false"
    if (typeof rawError === "string" && isSerializedToolError(rawError)) {
        return { error: parseSerializedToolError(rawError) }
    }

    return { error: rawError }
}

const TERSE_ERROR_PREFIX = "[TERSE ERROR]:"

function isSerializedToolError(value: string): boolean {
    return value.startsWith(TERSE_ERROR_PREFIX)
}

function parseSerializedToolError(value: string): string | unknown {
    if (!isSerializedToolError(value)) {
        return value
    }

    try {
        const parsed = JSON.parse(value.slice(TERSE_ERROR_PREFIX.length))
        if (parsed && typeof parsed === "object" && "error" in parsed) {
            return (parsed as { error: string | unknown }).error
        }
    } catch {
        return value
    }

    return value
}

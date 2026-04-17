import type { AgentInputItem, AssistantMessageItem, FunctionCallItem, FunctionCallResultItem, HostedToolCallItem, ReasoningItem, UserMessageItem } from "@openai/agents-core"
import { IntegrationType } from "terse-types/Integrations"
import { ModelEvent, ToolCallExecutionStatus } from "terse-types/ModelEvents"

import { OutputFactory } from "../outputs/abstract/OutputFactory"

import { isScaffoldedRunContextUserMessage } from "./AgentRunner/formatContext"
import { parseCancelledSystemEventItem } from "./systemEvents/cancelledSystemEvent"
import { parseFilterOutcomeSystemEventItem } from "./systemEvents/filterOutcomeSystemEvent"
import { parseProcessOutputSystemEventItem } from "./systemEvents/processOutputSystemEvent"
import { parseRunErrorSystemEventItem } from "./systemEvents/runErrorSystemEvent"
import { parseSnippetSystemEventItem } from "./systemEvents/snippetSystemEvent"
import { parseToolApprovalSystemEventItem } from "./systemEvents/toolApprovalSystemEvent"
import { parseToolExecutionResult } from "./toolExecution"

/** An AgentInputItem paired with the DB timestamp it was created at. */
export type TimestampedAgentInputItem = {
    item: AgentInputItem
    createdAt: Date
}

export type ConvertAgentInputItemsToModelEventsOptions = {
    includeScaffoldedUserMessages?: boolean
    appendNaturalStop?: boolean
}

const DEFAULT_CONVERT_OPTIONS: Required<ConvertAgentInputItemsToModelEventsOptions> = {
    includeScaffoldedUserMessages: true,
    appendNaturalStop: true
}

export async function convertAgentInputItemsToModelEvents(items: TimestampedAgentInputItem[], options?: ConvertAgentInputItemsToModelEventsOptions): Promise<ModelEvent[]> {
    const resolvedOptions: Required<ConvertAgentInputItemsToModelEventsOptions> = {
        ...DEFAULT_CONVERT_OPTIONS,
        ...options
    }
    const events: ModelEvent[] = []

    for (const [itemIndex, entry] of items.entries()) {
        const item: AgentInputItem = entry.item
        const ts = entry.createdAt
        const eventTimestamp = ts.getTime()
        const converted = await convertSingleItem(item, eventTimestamp, itemIndex, resolvedOptions)
        if (converted) {
            events.push(...converted)
        }
    }

    // Add a NaturalStop only when the run did not already end with a terminal sentinel (NaturalStop or RunError).
    // Skip for in-progress runs so the UI does not incorrectly set isGenerating=false until the run actually completes.
    if (events.length > 0 && resolvedOptions.appendNaturalStop) {
        const lastEvent = events[events.length - 1]
        const isTerminal = lastEvent.type === "NaturalStop" || lastEvent.type === "RunError" || lastEvent.type === "Cancelled"
        if (!isTerminal) {
            const timestamp = lastEvent.timestamp
            events.push({
                type: "NaturalStop",
                timestamp,
                step_id: "historical-stop"
            })
        }
    }

    return events
}

async function convertSingleItem(
    item: AgentInputItem,
    eventTimestamp: number,
    itemIndex: number,
    options: Required<ConvertAgentInputItemsToModelEventsOptions> = DEFAULT_CONVERT_OPTIONS
): Promise<ModelEvent[] | null> {
    const cancelledSystemEvent = parseCancelledSystemEventItem(item)
    if (cancelledSystemEvent) {
        return [
            {
                type: "Cancelled",
                timestamp: eventTimestamp,
                ...(cancelledSystemEvent.reason ? { reason: cancelledSystemEvent.reason } : {})
            }
        ]
    }

    const runErrorSystemEvent = parseRunErrorSystemEventItem(item)
    if (runErrorSystemEvent) {
        return [
            {
                type: "RunError",
                timestamp: eventTimestamp,
                error: runErrorSystemEvent.error,
                ...(runErrorSystemEvent.code ? { code: runErrorSystemEvent.code } : {})
            }
        ]
    }

    const filterOutcomeSystemEvent = parseFilterOutcomeSystemEventItem(item)
    if (filterOutcomeSystemEvent) {
        return [
            {
                type: "FilterResult",
                timestamp: eventTimestamp,
                isRelevant: filterOutcomeSystemEvent.isRelevant,
                reason: filterOutcomeSystemEvent.reason,
                confidence: filterOutcomeSystemEvent.confidence,
                step_id: "filter-marker"
            }
        ]
    }

    const toolApprovalSystemEvent = parseToolApprovalSystemEventItem(item)
    if (toolApprovalSystemEvent) {
        if (toolApprovalSystemEvent.type === "ToolApprovalRequest") {
            return [
                {
                    type: "ToolApprovalRequest",
                    timestamp: eventTimestamp,
                    step_id: toolApprovalSystemEvent.step_id,
                    name: toolApprovalSystemEvent.name,
                    arguments: toolApprovalSystemEvent.arguments
                }
            ]
        }

        return [
            {
                type: "ToolApprovalResponse",
                timestamp: eventTimestamp,
                step_id: toolApprovalSystemEvent.step_id,
                approved: toolApprovalSystemEvent.approved,
                rejection_reason: toolApprovalSystemEvent.rejection_reason || undefined
            }
        ]
    }

    const snippetSystemEvent = parseSnippetSystemEventItem(item)
    if (snippetSystemEvent) {
        return [
            {
                type: "Snippet",
                timestamp: eventTimestamp,
                snippet: snippetSystemEvent.snippet
            }
        ]
    }

    const processOutputSystemEvent = parseProcessOutputSystemEventItem(item)
    if (processOutputSystemEvent) {
        return [
            {
                type: "ProcessOutput",
                id: processOutputSystemEvent.id,
                timestamp: eventTimestamp,
                stream: processOutputSystemEvent.stream,
                content: processOutputSystemEvent.content,
                label: processOutputSystemEvent.label
            }
        ]
    }

    // User message
    if (isUserMessageItem(item)) {
        const text = extractTextFromMessageContent(item.content)
        if (text) {
            if (!options.includeScaffoldedUserMessages && isScaffoldedRunContextUserMessage(text)) {
                return null
            }
            const stepId = resolveUserMessageStepId(item, eventTimestamp, itemIndex)
            return [{ type: "UserMessage", timestamp: eventTimestamp, message: text, step_id: stepId, client_turn_id: stepId }]
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
                    timestamp: eventTimestamp,
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
                timestamp: eventTimestamp,
                step_id: stepId
            }
        ]
    }

    // Function call - convert to ToolCall
    if (isFunctionCallItem(item)) {
        const integration = OutputFactory.getToolIntegrationType(item.name)
        return [
            {
                type: "ToolCall",
                summary: item.name,
                timestamp: eventTimestamp,
                step_id: item.callId || item.id || "unknown",
                parameters: item.arguments || "{}",
                integration
            }
        ]
    }

    // Function call result - convert to ToolCallComplete
    // Note: changed_items are not populated here. Callers that need them (e.g. run history routes)
    // should load run_history_actions once and attach via attachRunHistoryChangedItems().
    if (isFunctionCallResultItem(item)) {
        const integration = OutputFactory.getToolIntegrationType(item.name || "")
        const status = item.status as ToolCallExecutionStatus
        const parsed = parseToolExecutionResult(item.output, status)

        const outputWithoutActions = {
            ...parsed.output,
            actions: undefined,
            snippets: undefined,
            snippet: undefined
        }

        const toolCallCompleteEvent: ModelEvent = {
            type: "ToolCallComplete",
            tool_name: item.name || "unknown",
            timestamp: eventTimestamp,
            status: parsed.status,
            step_id: item.callId,
            changed_items: [],
            integration,
            result: JSON.stringify(outputWithoutActions) || undefined,
            ...(parsed.errorContext ? { errorContext: { error: parsed.errorContext.error } } : {})
        }

        const snippetEvents: ModelEvent[] = (parsed.snippets ?? []).map(snippet => ({
            type: "Snippet",
            timestamp: eventTimestamp,
            snippet
        }))

        return [toolCallCompleteEvent, ...snippetEvents]
    }

    if (isWebSearchResultItem(item)) {
        const hostedToolCallItem = item as HostedToolCallItem
        const integration = IntegrationType.TERSE
        const toolCallCompleteEvent: ModelEvent = {
            type: "ToolCallComplete",
            tool_name: hostedToolCallItem.name,
            timestamp: eventTimestamp,
            status: (hostedToolCallItem.status as ToolCallExecutionStatus) || ToolCallExecutionStatus.COMPLETED,
            step_id: item.id || `web-search-${eventTimestamp}`,
            changed_items: [],
            integration,
            result: JSON.stringify(hostedToolCallItem.providerData?.action) || undefined
        }
        return [toolCallCompleteEvent]
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

function isWebSearchResultItem(event: AgentInputItem): boolean {
    return typeof event === "object" && event !== null && "type" in event && event.type === "hosted_tool_call" && event.name === "web_search_call"
}

function resolveUserMessageStepId(item: UserMessageItem, eventTimestamp: number, itemIndex: number): string {
    const itemId = typeof item.id === "string" ? item.id.trim() : ""
    if (itemId) {
        return itemId
    }

    // Backward compatibility for historical user messages persisted before IDs were guaranteed.
    return `legacy-user-msg-${eventTimestamp}-${itemIndex}`
}

function isTextMessagePart(part: unknown): part is { type: "input_text" | "output_text"; text: string } {
    return typeof part === "object" && part !== null && "type" in part && (part.type === "input_text" || part.type === "output_text") && "text" in part && typeof part.text === "string"
}

// Content extraction helpers
function extractTextFromMessageContent(content: UserMessageItem["content"] | AssistantMessageItem["content"]): string {
    if (typeof content === "string") {
        return content
    }

    if (Array.isArray(content)) {
        return content
            .filter(isTextMessagePart)
            .map(part => part.text)
            .join(" ")
    }

    return ""
}

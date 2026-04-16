import { Agent, FunctionCallResultItem, RunStreamEvent, RunToolCallOutputItem, StreamedRunResult } from "@openai/agents"
import { IntegrationType } from "terse-types/Integrations"
import { ChangedItem, type ChatSnippet, ModelEvent, ToolCallExecutionStatus } from "terse-types/ModelEvents"
import { RunHistoryAction } from "terse-types/RunHistoryTypes"

import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { ErrorContext } from "../tools/toolUtils"
import { Session } from "../types/session"
import { randomString } from "../utility/strings"

import { parseToolExecutionResult } from "./toolExecution"

export async function* transformAgentStreamToModelEvents<T extends Session>(
    result: StreamedRunResult<T, Agent<T, any>>,
    options: {
        onToolCall?: (stepId: string, toolName: string) => void
        onToolCallComplete?: ToolCallCompleteHandler
        onRawStreamEvent?: (event: RunStreamEvent) => Promise<void> | void
    } = {}
): AsyncGenerator<ModelEvent, void, unknown> {
    const { onToolCall, onToolCallComplete, onRawStreamEvent } = options
    const textDeltaIndexByStepId = new Map<string, number>()

    for await (const event of result as AsyncIterable<RunStreamEvent>) {
        if (onRawStreamEvent) {
            try {
                await onRawStreamEvent(event)
            } catch (error) {
                logger.warn("Failed to persist raw stream event", {
                    error,
                    eventType: event.type
                })
            }
        }

        // Try Thinking (reasoning start) - check early so users see activity immediately
        const thinkingEvent = tryExtractThinking(event)
        if (thinkingEvent) {
            yield thinkingEvent
            continue
        }

        // Try TextDelta
        const textDelta = tryExtractTextDelta(event, textDeltaIndexByStepId)
        if (textDelta) {
            yield textDelta
            continue
        }

        // Try ToolCall
        const toolCall = tryExtractToolCall(event)
        if (toolCall) {
            logger.info("[ApprovalFlow] Stream yielded ToolCall", { callId: (toolCall as any).step_id, name: (toolCall as any).summary })
            // Type guard: ensure it's a ToolCall event
            if (toolCall.type === "ToolCall" && onToolCall) {
                onToolCall(toolCall.step_id, toolCall.summary)
            }
            yield toolCall
            continue
        }

        // Try ToolCallComplete
        const toolCompleteData = tryExtractToolCallCompleteData(event)
        if (toolCompleteData) {
            const changedItems = onToolCallComplete ? await onToolCallComplete(toolCompleteData.callId, toolCompleteData.name, toolCompleteData.actions) : []

            yield createToolCallCompleteEvent(toolCompleteData, changedItems)
            if (toolCompleteData.snippets?.length) {
                for (const snippet of toolCompleteData.snippets) {
                    yield {
                        type: "Snippet",
                        timestamp: Date.now(),
                        snippet
                    }
                }
            }
            continue
        }

        // Try hosted tool calls (web_search, etc.) — these arrive as tool_called with status already completed
        const hostedToolComplete = tryExtractHostedToolCallComplete(event)
        if (hostedToolComplete) {
            const changedItems = onToolCallComplete ? await onToolCallComplete(hostedToolComplete.complete.step_id, hostedToolComplete.complete.tool_name, hostedToolComplete.actions) : []
            // Yield a ToolCall first so the UI sees the tool was invoked
            yield hostedToolComplete.toolCall
            yield { ...hostedToolComplete.complete, changed_items: changedItems }
            continue
        }
    }
}

export function tryExtractThinking(event: RunStreamEvent): ModelEvent | null {
    // Check for reasoning/thinking start events
    if (
        event.type === "raw_model_stream_event" &&
        (event as any).data?.type === "model" &&
        (event as any).data?.event?.type === "response.output_item.added" &&
        (event as any).data?.event?.item?.type === "reasoning"
    ) {
        const item = (event as any).data.event.item
        return {
            type: "Thinking",
            timestamp: Date.now(),
            step_id: item.id || "unknown"
        }
    }
    return null
}

export function tryExtractTextDelta(event: RunStreamEvent, deltaIndexByStepId?: Map<string, number>): ModelEvent | null {
    // Check for the nested OpenAI SDK event structure
    if (
        event.type === "raw_model_stream_event" &&
        (event as any).data?.type === "model" &&
        (event as any).data?.event?.type === "response.output_text.delta" &&
        typeof (event as any).data?.event?.delta === "string"
    ) {
        const eventData = (event as any).data.event
        const stepId = eventData.item_id || "unknown"
        const deltaIndex = deltaIndexByStepId ? (deltaIndexByStepId.get(stepId) ?? 0) : undefined
        if (deltaIndexByStepId) {
            deltaIndexByStepId.set(stepId, (deltaIndex ?? 0) + 1)
        }
        return {
            type: "TextDelta",
            timestamp: Date.now(),
            delta: eventData.delta,
            step_id: stepId,
            ...(typeof deltaIndex === "number" ? { delta_index: deltaIndex } : {})
        }
    }
    return null
}

export function tryExtractToolCallGenerating(event: RunStreamEvent): ModelEvent | null {
    // Check for function_call output item being added (before arguments are complete)
    if (
        event.type === "raw_model_stream_event" &&
        (event as any).data?.type === "model" &&
        (event as any).data?.event?.type === "response.output_item.added" &&
        (event as any).data?.event?.item?.type === "function_call"
    ) {
        const item = (event as any).data.event.item
        return {
            type: "ToolCallGenerating",
            timestamp: Date.now(),
            tool_name: item.name || "unknown",
            step_id: item.call_id || item.id || "unknown"
        }
    }
    return null
}

export function tryExtractToolCall(event: RunStreamEvent): ModelEvent | null {
    if (event.type === "run_item_stream_event" && event.name === "tool_called") {
        const item = (event as ToolCalledEvent).item.rawItem

        // Handle regular function calls
        if (item.type === "function_call") {
            const integration = OutputFactory.getToolIntegrationType(item.name)
            return {
                type: "ToolCall",
                timestamp: Date.now(),
                summary: item.name,
                step_id: item.callId || "unknown",
                parameters: item.arguments || "{}",
                integration
            }
        }
    }
    return null
}

export function tryExtractToolCallCompleteData(event: RunStreamEvent): ToolCallCompleteData | null {
    if (event.type === "run_item_stream_event" && event.name === "tool_output") {
        const item = event.item as RunToolCallOutputItem
        const rawItem = item.rawItem as FunctionCallResultItem

        const rawOutput = (rawItem as any).output ?? (item as any).output
        const status = rawItem.status as ToolCallExecutionStatus
        const parsed = parseToolExecutionResult(rawOutput, status)
        const outputWithoutActions = {
            ...parsed.output,
            actions: undefined,
            snippets: undefined,
            snippet: undefined
        }

        // Handle function call results
        if (rawItem.type === "function_call_result") {
            return {
                name: rawItem.name || "unknown",
                callId: rawItem.callId || "unknown",
                status: parsed.status,
                errorContext: parsed.errorContext,
                actions: parsed.actions,
                result: JSON.stringify(outputWithoutActions) ?? undefined,
                snippets: parsed.snippets
            }
        }
    }
    return null
}

export function createToolCallCompleteEvent(data: ToolCallCompleteData, changedItems: ChangedItem[]): ModelEvent {
    const integration = OutputFactory.getToolIntegrationType(data.name)

    const event: ModelEvent = {
        type: "ToolCallComplete",
        timestamp: Date.now(),
        tool_name: data.name,
        status: data.status,
        step_id: data.callId,
        changed_items: changedItems,
        integration,
        ...(data.result ? { result: data.result } : {}),
        // Only include errorContext if it exists (don't set to undefined)
        ...(data.errorContext ? { errorContext: { error: data.errorContext.error } } : {})
    }

    return event
}

export function tryExtractHostedToolCallComplete(event: RunStreamEvent): {
    toolCall: Extract<ModelEvent, { type: "ToolCall" }>
    complete: Extract<ModelEvent, { type: "ToolCallComplete" }>
    actions?: RunHistoryAction[]
} | null {
    if (event.type === "run_item_stream_event" && event.name === "tool_called") {
        const item = (event as ToolCalledEvent).item.rawItem

        if (item.type === "hosted_tool_call" && item.status === "completed") {
            const callId = item.id || "unknown"
            const name = item.name || "unknown"
            const integration = OutputFactory.getToolIntegrationType(name)
            const webAction = item.providerData?.action
            const ts = Date.now()

            return {
                toolCall: {
                    type: "ToolCall",
                    timestamp: ts,
                    summary: name,
                    step_id: callId,
                    parameters: "{}",
                    integration
                },
                complete: {
                    type: "ToolCallComplete",
                    timestamp: ts,
                    tool_name: name,
                    status: ToolCallExecutionStatus.COMPLETED,
                    step_id: callId,
                    changed_items: [],
                    integration,
                    result: JSON.stringify(item.providerData?.action) || undefined
                },
                actions:
                    webAction?.type === "open_page" && webAction.url
                        ? [
                              {
                                  action: "Opened URL",
                                  integration: IntegrationType.TERSE,
                                  target: webAction.url,
                                  details: `Opened page: ${webAction.url}`,
                                  url: webAction.url,
                                  type: "read",
                                  isReadOnly: true
                              }
                          ]
                        : undefined
            }
        }
    }
    return null
}

export function createNaturalStopEvent(): ModelEvent {
    // generate a random step_id
    const ts = Date.now()
    return { type: "NaturalStop", step_id: randomString(15), timestamp: ts }
}

export function createCancelledEvent(reason?: string): ModelEvent {
    const ts = Date.now()
    if (reason?.trim()) {
        return { type: "Cancelled", reason: reason.trim(), timestamp: ts }
    }
    return { type: "Cancelled", timestamp: ts }
}

export enum RawModelStreamEventType {
    OutputTextDelta = "output_text_delta",
    Model = "model"
}

export enum ToolCallRuntimeStatus {
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    INCOMPLETE = "incomplete"
}

export type RawModelStreamEvent = {
    type: "raw_model_stream_event"
    data: {
        type: RawModelStreamEventType | "model"
        delta?: string
        providerData?: { item_id?: string; step_id?: string }
        event?: {
            type:
                | "response.output_text.delta"
                | "response.created"
                | "response.in_progress"
                | "response.output_item.added"
                | "response.content_part.added"
                | "response.output_text.done"
                | "response.content_part.done"
                | "response.output_item.done"
                | "response.completed"
                | string
            delta?: string
            item_id?: string
            sequence_number?: number
            output_index?: number
            content_index?: number
            [key: string]: any
        }
    }
}

export type ToolCalledEvent = {
    type: "run_item_stream_event"
    name: "tool_called"
    item: {
        type: "tool_call_item"
        rawItem: {
            providerData?: any
            id?: string
            type: "function_call" | "hosted_tool_call"
            callId?: string
            name: string
            status?: ToolCallRuntimeStatus
            arguments?: string
        }
        agent: any
    }
}

export type ToolCallCompleteEvent = {
    type: "run_item_stream_event"
    name: "tool_output"
    item: {
        type: "tool_call_output_item"
        rawItem: {
            type: "function_call_result" | "hosted_tool_call" | "hosted_tool_call_result"
            name: string
            callId?: string
            id?: string
            status: ToolCallRuntimeStatus
            output?: any
        }
        agent: any
        output?: any
    }
}

export type AgentStreamEvent = RawModelStreamEvent | ToolCalledEvent | ToolCallCompleteEvent

export type ToolCallCompleteHandler = (callId: string, toolName: string, actions?: RunHistoryAction[]) => Promise<ChangedItem[]>

export type ToolCallCompleteData = {
    name: string
    callId: string
    status: ToolCallExecutionStatus
    result?: string
    errorContext?: ErrorContext
    actions?: RunHistoryAction[]
    snippets?: ChatSnippet[]
}

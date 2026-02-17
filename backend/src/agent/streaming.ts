import { Agent, FunctionCallResultItem, RunStreamEvent, RunToolCallOutputItem, StreamedRunResult } from "@openai/agents"

import { IntegrationType } from "../shared/Integrations"
import { ChangedItem, ModelEvent, ToolCallExecutionStatus } from "../shared/ModelEvents"
import { RunHistoryAction } from "../shared/RunHistoryTypes"
import { ErrorContext } from "../tools/toolUtils"
import { Session } from "../types/session"
import { randomString } from "../utility/strings"

import { parseToolExecutionResult } from "./toolExecution"

export async function* transformAgentStreamToModelEvents<T extends Session>(
    result: StreamedRunResult<T, Agent<T, any>>,
    options: {
        toolToIntegrationMap?: Map<string, string>
        onToolCall?: (stepId: string, toolName: string) => void
        onToolCallComplete?: ToolCallCompleteHandler
    } = {}
): AsyncGenerator<ModelEvent, void, unknown> {
    const { toolToIntegrationMap, onToolCall, onToolCallComplete } = options

    for await (const event of result as AsyncIterable<RunStreamEvent>) {
        // Try Thinking (reasoning start) - check early so users see activity immediately
        const thinkingEvent = tryExtractThinking(event)
        if (thinkingEvent) {
            yield thinkingEvent
            continue
        }

        // Try TextDelta
        const textDelta = tryExtractTextDelta(event)
        if (textDelta) {
            yield textDelta
            continue
        }

        // Try ToolCall
        const toolCall = tryExtractToolCall(event, toolToIntegrationMap)
        if (toolCall) {
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

            yield createToolCallCompleteEvent(toolCompleteData, changedItems, toolToIntegrationMap)
            continue
        }
    }

    yield createNaturalStopEvent()
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
            step_id: item.id || "unknown"
        }
    }
    return null
}

export function tryExtractTextDelta(event: RunStreamEvent): ModelEvent | null {
    // Check for the nested OpenAI SDK event structure
    if (
        event.type === "raw_model_stream_event" &&
        (event as any).data?.type === "model" &&
        (event as any).data?.event?.type === "response.output_text.delta" &&
        typeof (event as any).data?.event?.delta === "string"
    ) {
        const eventData = (event as any).data.event
        return {
            type: "TextDelta",
            delta: eventData.delta,
            step_id: eventData.item_id || "unknown"
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
            tool_name: item.name || "unknown",
            step_id: item.call_id || item.id || "unknown"
        }
    }
    return null
}

export function tryExtractToolCall(event: RunStreamEvent, toolToIntegrationMap?: Map<string, string>): ModelEvent | null {
    if (event.type === "run_item_stream_event" && event.name === "tool_called") {
        const item = (event as ToolCalledEvent).item.rawItem

        // Handle regular function calls
        if (item.type === "function_call") {
            const integration = toolToIntegrationMap?.get(item.name) || "unknown"
            return {
                type: "ToolCall",
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
        const parsed = parseToolExecutionResult(rawOutput, rawItem.status)

        // Handle function call results (including hosted tool calls)
        if (rawItem.type === "function_call_result") {
            return {
                name: rawItem.name || "unknown",
                callId: rawItem.callId || "unknown",
                status: parsed.status,
                errorContext: parsed.errorContext,
                actions: parsed.actions,
                result: parsed.outputString ?? undefined
            }
        }

        // Handle hosted tool calls (check via type assertion as it's not in the union type)
        if (rawItem.type === "hosted_tool_call_result" || rawItem.type === "hosted_tool_call") {
            return {
                name: rawItem.name || "unknown",
                callId: rawItem.id || rawItem.callId || "unknown",
                status: parsed.status,
                errorContext: parsed.errorContext,
                actions: parsed.actions,
                result: parsed.outputString ?? undefined
            }
        }
    }
    return null
}

export function createToolCallCompleteEvent(data: ToolCallCompleteData, changedItems: ChangedItem[], toolToIntegrationMap?: Map<string, string>): ModelEvent {
    const integration = toolToIntegrationMap?.get(data.name) || IntegrationType.TERSE

    const event: ModelEvent = {
        type: "ToolCallComplete",
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

export function createNaturalStopEvent(): ModelEvent {
    // generate a random step_id
    return { type: "NaturalStop", step_id: randomString(15) }
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
}

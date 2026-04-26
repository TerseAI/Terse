import { Agent, FunctionCallResultItem, ResponseStreamEvent, RunRawModelStreamEvent, RunStreamEvent, RunToolCallOutputItem, StreamedRunResult } from "@openai/agents"
import { IntegrationType } from "terse-types/Integrations"
import { ChangedItem, type ChatSnippet, ModelEvent, ToolCallExecutionStatus } from "terse-types/ModelEvents"
import { RunHistoryAction } from "terse-types/RunHistoryTypes"

import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { ErrorContext } from "../tools/toolUtils"
import { Session } from "../types/session"
import { randomString } from "../utility/strings"

import { AssistantDeltaProjector, CanonicalModelEvent } from "./DeltaProjector"
import { parseToolExecutionResult } from "./toolExecution"

export async function* transformAgentStreamToModelEvents<T extends Session>(
    result: StreamedRunResult<T, Agent<T, any>>,
    options: {
        onToolCall?: (stepId: string, toolName: string) => void
        onToolCallComplete?: ToolCallCompleteHandler
    } = {}
): AsyncGenerator<ModelEvent, void, unknown> {
    const { onToolCallComplete } = options
    const deltaProjector = new AssistantDeltaProjector()

    for await (const event of result) {
        const canonicalEvent = deltaProjector.ingestModelEvent(event)
        if (!canonicalEvent) continue
        switch (canonicalEvent.type) {
            case "text-delta":
                yield {
                    id: canonicalEvent.id,
                    response_id: canonicalEvent.responseId,
                    timestamp: Date.now(),
                    delta: canonicalEvent.delta,
                    type: "TextDelta"
                }
                continue
            case "reasoning-start":
                yield {
                    id: canonicalEvent.id,
                    response_id: canonicalEvent.responseId,
                    timestamp: Date.now(),
                    type: "Thinking"
                }
                continue
            case "tool-call":
                if (!canonicalEvent.toolName) return
                const integration = OutputFactory.getToolIntegrationType(canonicalEvent.toolName)
                yield {
                    id: canonicalEvent.id,
                    response_id: canonicalEvent.responseId,
                    type: "ToolCall",
                    timestamp: Date.now(),
                    summary: canonicalEvent.toolName,
                    parameters: JSON.stringify(canonicalEvent.input) ?? "{}",
                    integration
                }
                continue
            case "tool-result":
                yield* yieldToolCallCompletionStream(canonicalEvent, ToolCallExecutionStatus.COMPLETED, onToolCallComplete)
                continue
            case "tool-error":
                yield* yieldToolCallCompletionStream(canonicalEvent, ToolCallExecutionStatus.FAILED, onToolCallComplete)
                continue
        }
    }
}

type ToolCallCompletionCanonicalEvent = Extract<CanonicalModelEvent, { type: "tool-result" }> | Extract<CanonicalModelEvent, { type: "tool-error" }>

async function* yieldToolCallCompletionStream(
    canonicalEvent: ToolCallCompletionCanonicalEvent,
    executionStatus: ToolCallExecutionStatus,
    onToolCallComplete?: ToolCallCompleteHandler
): AsyncGenerator<ModelEvent, void, unknown> {
    const { id, toolName } = canonicalEvent
    const output = canonicalEvent.type === "tool-result" ? canonicalEvent.output : canonicalEvent.error
    const parsed = parseToolExecutionResult(output, executionStatus)
    const outputWithoutActions = {
        ...parsed.output,
        actions: undefined,
        snippets: undefined,
        snippet: undefined
    }
    const toolCompleteData: ToolCallCompleteData = {
        id,
        response_id: canonicalEvent.responseId,
        name: toolName ?? "unknown",
        callId: id,
        status: parsed.status,
        errorContext: parsed.errorContext,
        actions: parsed.actions,
        result: JSON.stringify(outputWithoutActions) ?? undefined,
        snippets: parsed.snippets
    }
    const changedItems = onToolCallComplete ? await onToolCallComplete(toolCompleteData.callId, toolCompleteData.name, toolCompleteData.actions) : []
    yield createToolCallCompleteEvent(toolCompleteData, changedItems)
    if (toolCompleteData.snippets?.length) {
        for (const snippet of toolCompleteData.snippets) {
            yield {
                id: randomString(15),
                response_id: canonicalEvent.responseId,
                type: "Snippet",
                timestamp: Date.now(),
                snippet
            }
        }
    }
}

export function createToolCallCompleteEvent(data: ToolCallCompleteData, changedItems: ChangedItem[]): ModelEvent {
    const integration = OutputFactory.getToolIntegrationType(data.name)

    const event: ModelEvent = {
        id: data.id,
        response_id: data.response_id,
        type: "ToolCallComplete",
        timestamp: Date.now(),
        tool_name: data.name,
        status: data.status,
        changed_items: changedItems,
        integration,
        ...(data.result ? { result: data.result } : {}),
        // Only include errorContext if it exists (don't set to undefined)
        ...(data.errorContext ? { errorContext: { error: data.errorContext.error } } : {})
    }

    return event
}

export function createNaturalStopEvent(): ModelEvent {
    const ts = Date.now()
    const id = randomString(15)
    return { type: "NaturalStop", id, response_id: id, timestamp: ts }
}

export function createCancelledEvent(reason?: string): ModelEvent {
    const ts = Date.now()
    const id = randomString(15)
    if (reason?.trim()) {
        return { type: "Cancelled", id, response_id: id, reason: reason.trim(), timestamp: ts }
    }
    return { type: "Cancelled", id, response_id: id, timestamp: ts }
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
    id: string
    response_id: string
    name: string
    callId: string
    status: ToolCallExecutionStatus
    result?: string
    errorContext?: ErrorContext
    actions?: RunHistoryAction[]
    snippets?: ChatSnippet[]
}

// New stuff

type ModelStreamEvent = {
    type: string
    id?: unknown
    delta?: unknown
    toolName?: unknown
    providerMetadata?: unknown
    [key: string]: unknown
}

function getRawModelData(event: RunStreamEvent): ResponseStreamEvent | undefined {
    return event.type === "raw_model_stream_event" ? (event.data as ResponseStreamEvent) : undefined
}

function extractModelEvent(event: RunStreamEvent): ModelStreamEvent | undefined {
    const data = getRawModelData(event)
    return data ? getModelStreamEvent(data) : undefined
}

function getModelStreamEvent(data: ResponseStreamEvent): ModelStreamEvent | undefined {
    if (data.type !== "model") return undefined
    if (!data.event || typeof data.event !== "object") return undefined
    return data.event as ModelStreamEvent
}

export function readNonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

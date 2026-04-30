import { Agent, RunStreamEvent, StreamedRunResult } from "@openai/agents"
import { CreditGateDeniedError, StripeError } from "terse-types"
import { ChangedItem, type ChatSnippet, ModelEvent, ToolCallExecutionStatus } from "terse-types/ModelEvents"
import { RunHistoryAction } from "terse-types/RunHistoryTypes"

import { ApprovalDecision } from "../agent/AgentRunner/BaseAgentRunner"
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
        onToolCallComplete?: ToolCallCompleteHandler
        approvalDecision?: ApprovalDecision
        onRawStreamEvent?: (event: RunStreamEvent) => Promise<void> | void
    } = {}
): AsyncGenerator<ModelEvent, void, unknown> {
    const { onToolCallComplete, approvalDecision, onRawStreamEvent } = options
    let initialResponseId: string | undefined = undefined
    if (approvalDecision) {
        initialResponseId = approvalDecision.responseId
    }
    const deltaProjector = new AssistantDeltaProjector({ initialResponseId })

    for await (const event of result) {
        if (onRawStreamEvent) {
            try {
                await onRawStreamEvent(event)
            } catch (error) {
                if (error instanceof StripeError) throw error
                if (error instanceof CreditGateDeniedError) throw error
                logger.warn("Failed to persist raw stream event", {
                    error,
                    eventType: event.type
                })
            }
        }
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
                yield* yieldToolCallCompletionStream(canonicalEvent, ToolCallExecutionStatus.COMPLETED, onToolCallComplete, approvalDecision)
                continue
            case "tool-error":
                yield* yieldToolCallCompletionStream(canonicalEvent, ToolCallExecutionStatus.FAILED, onToolCallComplete, approvalDecision)
                continue
            case "finish": {
                const id = randomString(15)
                yield {
                    id,
                    response_id: canonicalEvent.responseId ?? id,
                    timestamp: Date.now(),
                    type: "NaturalStop"
                }
                continue
            }
            default:
                continue
        }
    }
}

type ToolCallCompletionCanonicalEvent = Extract<CanonicalModelEvent, { type: "tool-result" }> | Extract<CanonicalModelEvent, { type: "tool-error" }>

async function* yieldToolCallCompletionStream(
    canonicalEvent: ToolCallCompletionCanonicalEvent,
    executionStatus: ToolCallExecutionStatus,
    onToolCallComplete?: ToolCallCompleteHandler,
    approvalDecision?: ApprovalDecision
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
    if (approvalDecision) {
        yield createToolApprovalResponseEvent(toolCompleteData, approvalDecision)
    }
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

function createToolApprovalResponseEvent(data: ToolCallCompleteData, approvalDecision?: ApprovalDecision): ModelEvent {
    const approved = approvalDecision?.decision === "approve"
    const rejectionReason = approvalDecision?.rejectionReason

    return {
        id: data.id,
        response_id: data.response_id,
        type: "ToolApprovalResponse",
        timestamp: Date.now(),
        approved,
        rejection_reason: rejectionReason
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

export function createCancelledEvent(reason?: string): ModelEvent {
    const ts = Date.now()
    const id = randomString(15)
    if (reason?.trim()) {
        return { type: "Cancelled", id, response_id: id, reason: reason.trim(), timestamp: ts }
    }
    return { type: "Cancelled", id, response_id: id, timestamp: ts }
}

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

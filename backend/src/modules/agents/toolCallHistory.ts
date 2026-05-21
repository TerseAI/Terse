import type { AgentInputItem } from "@openai/agents-core"
import { RunHistoryAction } from "terse-types/RunHistoryTypes"

import { emitCacheInvalidationWithWildcard } from "../../services/CacheInvalidationService"

import { appendRunAction } from "./AgentRunner/runHistory"
import { appendRunHistoryItems } from "./systemEvents/systemEventSessions"

export type DeterministicToolCallRunContext = {
    runId: string
    agentId: string
    organizationId: string
}

type DeterministicToolCallMeta = {
    isReadOnly: boolean
}

function buildToolCallItem(toolName: string, toolParams: Record<string, unknown>, callId: string): AgentInputItem {
    return {
        type: "function_call",
        callId,
        name: toolName,
        arguments: JSON.stringify(toolParams)
    } as AgentInputItem
}

function buildToolCallResultItem(toolName: string, callId: string, status: "completed" | "failed", output: unknown): AgentInputItem {
    return {
        type: "function_call_result",
        callId,
        name: toolName,
        status,
        output
    } as AgentInputItem
}

export function extractRunHistoryActions(result: unknown): RunHistoryAction[] {
    if (!result || typeof result !== "object" || !("actions" in result)) {
        return []
    }

    const actions = (result as { actions?: unknown }).actions
    return Array.isArray(actions) ? (actions as RunHistoryAction[]) : []
}

export async function persistDeterministicToolCallStart(runContext: DeterministicToolCallRunContext, toolName: string, toolParams: Record<string, unknown>, callId: string): Promise<void> {
    await appendRunHistoryItems(runContext.runId, [buildToolCallItem(toolName, toolParams, callId)])
    emitCacheInvalidationWithWildcard(runContext.organizationId, "chatHistory", runContext.runId)
}

export async function persistDeterministicToolCallComplete(
    runContext: DeterministicToolCallRunContext,
    toolMeta: DeterministicToolCallMeta,
    toolName: string,
    result: unknown,
    callId: string
): Promise<void> {
    await appendRunHistoryItems(runContext.runId, [buildToolCallResultItem(toolName, callId, "completed", result)])

    const actions = extractRunHistoryActions(result)
    for (const action of actions) {
        await appendRunAction(
            runContext.runId,
            {
                ...action,
                step_id: action.step_id || callId,
                isReadOnly: action.isReadOnly ?? toolMeta.isReadOnly
            },
            runContext.organizationId,
            callId
        )
    }

    emitCacheInvalidationWithWildcard(runContext.organizationId, "chatHistory", runContext.runId)
    emitCacheInvalidationWithWildcard(runContext.organizationId, "runHistory", runContext.agentId)
}

export async function persistDeterministicToolCallFailure(runContext: DeterministicToolCallRunContext, toolName: string, errorMessage: string, callId: string): Promise<void> {
    await appendRunHistoryItems(runContext.runId, [
        buildToolCallResultItem(toolName, callId, "failed", {
            success: false,
            text: errorMessage
        })
    ])

    emitCacheInvalidationWithWildcard(runContext.organizationId, "chatHistory", runContext.runId)
    emitCacheInvalidationWithWildcard(runContext.organizationId, "runHistory", runContext.agentId)
}

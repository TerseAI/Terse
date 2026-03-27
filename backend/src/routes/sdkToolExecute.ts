import { FunctionTool, type RunContext } from "@openai/agents"
import type { AgentInputItem } from "@openai/agents-core"
import { Request, Response } from "express"
import { z } from "zod"

import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner"
import { appendRunAction } from "../agent/AgentRunner/runHistory"
import { RunHistoryChatMemorySession } from "../agent/CustomMemorySession"
import { emitSessionEvent } from "../agent/SessionEventBus"
import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithWildcard } from "../services/CacheInvalidationService"
import { RunHistoryAction } from "../shared/RunHistoryTypes"
import { User } from "../shared/types"
import { Session } from "../types/session"
import { randomString } from "../utility/strings"

type SdkFunctionTool = FunctionTool<SessionWithTracking<Session>, z.ZodObject<any>, unknown>
type SdkToolDescriptor = {
    tool: SdkFunctionTool
    isReadOnly: boolean
}
type PersistedRunContext = {
    runId: string
    agentId: string
    organizationId: string
}

/**
 * Finds a tool by name across all registered Output toolboxes.
 * Iterates OutputFactory.OUTPUT_REGISTRY, instantiates each Output, and searches their toolboxes.
 */
function findToolByName(toolName: string): SdkToolDescriptor | null {
    for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
        const output = factory()
        for (const entry of output.toolbox) {
            if (entry.tool.name === toolName) {
                return {
                    tool: entry.tool as SdkFunctionTool,
                    isReadOnly: entry.isReadOnly
                }
            }
        }
    }
    return null
}

function normalizeInvokedToolResult(rawResult: unknown): unknown {
    // OpenAI tools can return wrapped text output: { type: "text", text: "<json>" }
    if (rawResult && typeof rawResult === "object" && "text" in rawResult && typeof (rawResult as { text?: unknown }).text === "string") {
        const text = (rawResult as { text: string }).text
        try {
            return JSON.parse(text)
        } catch {
            return text
        }
    }

    if (typeof rawResult === "string") {
        try {
            return JSON.parse(rawResult)
        } catch {
            return rawResult
        }
    }

    return rawResult
}

function extractActions(result: unknown): RunHistoryAction[] {
    if (!result || typeof result !== "object" || !("actions" in result)) {
        return []
    }
    const actions = (result as { actions?: unknown }).actions
    return Array.isArray(actions) ? (actions as RunHistoryAction[]) : []
}

async function resolvePersistedRunContext(runIdHeader: string | undefined, user: User): Promise<PersistedRunContext | null> {
    const runId = runIdHeader?.trim()
    if (!runId || !user.organizationId) {
        return null
    }

    const runRecord = await db().run_history_records.findFirst({
        where: {
            id: runId,
            automation: {
                organization_id: user.organizationId
            }
        },
        select: {
            id: true,
            automation_id: true,
            automation: {
                select: {
                    organization_id: true
                }
            }
        }
    })

    if (!runRecord?.automation.organization_id) {
        logger.warn("[sdk/tool-execute] Ignoring unresolvable run tracking header", {
            requestedRunId: runId,
            userId: user.id,
            organizationId: user.organizationId
        })
        return null
    }

    return {
        runId: runRecord.id,
        agentId: runRecord.automation_id,
        organizationId: runRecord.automation.organization_id
    }
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

async function persistDeterministicToolCallStart(runContext: PersistedRunContext, toolName: string, toolParams: Record<string, unknown>, callId: string): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runContext.runId })
    await session.addItems([buildToolCallItem(toolName, toolParams, callId)])
    emitCacheInvalidationWithWildcard(runContext.organizationId, "chatHistory", runContext.runId)
}

async function persistDeterministicToolCallComplete(
    runContext: PersistedRunContext,
    toolDescriptor: Pick<SdkToolDescriptor, "isReadOnly">,
    toolName: string,
    result: unknown,
    callId: string
): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runContext.runId })
    await session.addItems([buildToolCallResultItem(toolName, callId, "completed", result)])

    const actions = extractActions(result)
    for (const action of actions) {
        await appendRunAction(
            runContext.runId,
            {
                ...action,
                step_id: action.step_id || callId,
                isReadOnly: action.isReadOnly ?? toolDescriptor.isReadOnly
            },
            callId
        )
    }

    emitCacheInvalidationWithWildcard(runContext.organizationId, "chatHistory", runContext.runId)
    emitCacheInvalidationWithWildcard(runContext.organizationId, "runHistory", runContext.agentId)
}

async function persistDeterministicToolCallFailure(runContext: PersistedRunContext, toolName: string, errorMessage: string, callId: string): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runContext.runId })
    await session.addItems([
        buildToolCallResultItem(toolName, callId, "failed", {
            success: false,
            text: errorMessage
        })
    ])

    emitCacheInvalidationWithWildcard(runContext.organizationId, "chatHistory", runContext.runId)
    emitCacheInvalidationWithWildcard(runContext.organizationId, "runHistory", runContext.agentId)
}

/**
 * POST /sdk/tool-execute
 *
 * Executes a tool deterministically (no LLM involved).
 * The developer calls `agent.executeTool()` in their onTrigger code,
 * which hits this endpoint. The backend holds OAuth tokens and credentials.
 */
export async function handleToolExecute(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const { toolName, params } = req.body as { toolName?: string; params?: Record<string, unknown> }

    if (!toolName || typeof toolName !== "string") {
        return res.status(400).json({ success: false, error: "toolName is required and must be a string" })
    }

    if (params !== undefined && (typeof params !== "object" || params === null || Array.isArray(params))) {
        return res.status(400).json({ success: false, error: "params must be a plain object" })
    }

    const toolDescriptor = findToolByName(toolName)
    if (!toolDescriptor) {
        return res.status(404).json({ success: false, error: `Tool "${toolName}" not found` })
    }

    const sessionId = req.headers["x-terse-session-id"] as string | undefined
    const persistedRunContext = await resolvePersistedRunContext(req.headers["x-terse-run-id"] as string | undefined, user)
    const effectiveRunId = persistedRunContext?.runId ?? `sdk-tool-execute-${Date.now()}`
    const effectiveAgentId = persistedRunContext?.agentId ?? "sdk-tool-execute"
    const toolParams = params ?? {}
    const callId = `sdk-tool-${randomString(15)}`

    if (sessionId) {
        emitSessionEvent(sessionId, { type: "tool_call_params", toolCallParams: JSON.stringify(toolParams) })
        emitSessionEvent(sessionId, { type: "tool_call_started", toolCallStarted: toolName })
    }

    if (persistedRunContext) {
        await persistDeterministicToolCallStart(persistedRunContext, toolName, toolParams, callId)
    }

    const runContextPayload = {
        context: {
            user,
            isUserInitiated: true,
            agent: { requireApproval: false, toolApprovals: [] },
            runId: effectiveRunId,
            agentId: effectiveAgentId
        } satisfies SessionWithTracking<Session>
    }

    try {
        const invokeContext = runContextPayload as unknown as RunContext<SessionWithTracking<Session>>
        const rawResult = await toolDescriptor.tool.invoke(invokeContext, JSON.stringify(toolParams))
        const result = normalizeInvokedToolResult(rawResult)
        const actions = extractActions(result)

        if (persistedRunContext) {
            await persistDeterministicToolCallComplete(persistedRunContext, toolDescriptor, toolName, result, callId)
        }

        if (sessionId) {
            emitSessionEvent(sessionId, {
                type: "tool_call_completed",
                toolCallCompleted: JSON.stringify({ tool: toolName, status: "completed" })
            })
            if (actions.length > 0) {
                for (const action of actions) {
                    emitSessionEvent(sessionId, { type: "action", action })
                }
            }
        }

        return res.json({ success: true, result })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error("[sdk/tool-execute] Tool execution failed", { toolName, error: message })

        if (persistedRunContext) {
            await persistDeterministicToolCallFailure(persistedRunContext, toolName, message, callId)
        }

        if (sessionId) {
            emitSessionEvent(sessionId, {
                type: "tool_call_completed",
                toolCallCompleted: JSON.stringify({ tool: toolName, status: "failed", error: message })
            })
        }

        return res.status(500).json({ success: false, error: message })
    }
}

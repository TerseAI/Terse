import { FunctionTool, type RunContext, Tool, tool } from "@openai/agents"
import { Request, Response } from "express"
import crypto from "node:crypto"
import { User } from "terse-types/types"
import { sdkToolExecuteRequestSchema } from "terse-types/types"
import { z } from "zod"

import logger from "../../../common/logger"
import { extractErrorMessage, randomString } from "../../../common/strings"
import { SessionWithTracking } from "../../../domains/agents/AgentRunner/BaseAgentRunner"
import { emitSessionEvent } from "../../../domains/agents/SessionEventBus"
import {
    type DeterministicToolCallRunContext,
    extractRunHistoryActions,
    persistDeterministicToolCallComplete,
    persistDeterministicToolCallFailure,
    persistDeterministicToolCallStart
} from "../../../domains/agents/toolCallHistory"
import { Session } from "../../../express"
import { db } from "../../../loaders/prisma"
import { OutputFactory } from "../../../outputs/abstract/OutputFactory"

type SdkFunctionTool = FunctionTool<SessionWithTracking<Session>, z.ZodObject<any>, unknown>
type SdkToolDescriptor = {
    tool: SdkFunctionTool
    isReadOnly: boolean
}

export async function handleToolDefinitions(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) return res.status(401).json({ error: "Unauthorized" })

    try {
        const tools: Array<{ name: string; displayName: string; description: string; integration: string; isReadOnly: boolean; supportsApproval: boolean }> = []
        const seen = new Set<string>()

        for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
            const output = factory()
            for (const entry of output.toolbox) {
                const toolEntry = tool(entry.tool) as Tool
                const name = toolEntry.name
                if (seen.has(name)) continue
                seen.add(name)

                const ft = toolEntry as FunctionTool
                tools.push({
                    name,
                    displayName: entry.displayName,
                    description: ft.description ?? "",
                    integration: entry.integration,
                    isReadOnly: entry.isReadOnly,
                    supportsApproval: entry.supportsApproval ?? false
                })
            }
        }

        return res.json({ tools })
    } catch (error) {
        const message = extractErrorMessage(error)
        logger.error("[sdk/tool-definitions] Failed to collect tool definitions", { error: message })
        return res.status(500).json({ error: "Failed to collect tool definitions" })
    }
}

function findToolByName(toolName: string): SdkToolDescriptor | null {
    for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
        const output = factory()
        for (const entry of output.toolbox) {
            entry.tool.errorFunction = (_context: RunContext, error: Error | unknown) => {
                throw new Error(error instanceof Error ? error.message : String(error))
            }
            if (entry.tool.name === toolName) {
                return { tool: tool(entry.tool) as SdkFunctionTool, isReadOnly: entry.isReadOnly }
            }
        }
    }
    return null
}

function normalizeInvokedToolResult(rawResult: unknown): unknown {
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

async function resolvePersistedRunContext(runIdHeader: string | undefined, user: User): Promise<DeterministicToolCallRunContext | null> {
    const runId = runIdHeader?.trim()
    if (!runId || !user.organizationId) return null

    const runRecord = await db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: user.organizationId } },
        select: { id: true, automation_id: true, automation: { select: { organization_id: true } } }
    })

    if (!runRecord?.automation.organization_id) {
        logger.warn("[sdk/tool-execute] Ignoring unresolvable run tracking header", { requestedRunId: runId, userId: user.id, organizationId: user.organizationId })
        return null
    }

    return { runId: runRecord.id, agentId: runRecord.automation_id, organizationId: runRecord.automation.organization_id }
}

export async function handleToolExecute(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" })

    const { toolName, params } = sdkToolExecuteRequestSchema.parse(req.body)

    const toolDescriptor = findToolByName(toolName)
    if (!toolDescriptor) return res.status(404).json({ success: false, error: `Tool "${toolName}" not found` })

    const sessionId = req.headers["x-terse-session-id"] as string | undefined
    const persistedRunContext = await resolvePersistedRunContext(req.headers["x-terse-run-id"] as string | undefined, user)
    const effectiveRunId = persistedRunContext?.runId ?? crypto.randomUUID()
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
            agent: { toolApprovals: [] },
            runId: effectiveRunId,
            agentId: effectiveAgentId
        } satisfies SessionWithTracking<Session>
    }

    try {
        const invokeContext = runContextPayload as unknown as RunContext<SessionWithTracking<Session>>
        const rawResult = await toolDescriptor.tool.invoke(invokeContext, JSON.stringify(toolParams))
        const result = normalizeInvokedToolResult(rawResult)
        const actions = extractRunHistoryActions(result)

        if (persistedRunContext) {
            await persistDeterministicToolCallComplete(persistedRunContext, toolDescriptor, toolName, result, callId)
        }

        if (sessionId) {
            emitSessionEvent(sessionId, { type: "tool_call_completed", toolCallCompleted: JSON.stringify({ tool: toolName, status: "completed" }) })
            if (actions.length > 0) {
                for (const action of actions) {
                    emitSessionEvent(sessionId, { type: "action", action })
                }
            }
        }

        return res.json({ success: true, result })
    } catch (err) {
        const message = extractErrorMessage(err)
        logger.error("[sdk/tool-execute] Tool execution failed", { toolName, error: message })

        if (persistedRunContext) {
            await persistDeterministicToolCallFailure(persistedRunContext, toolName, message, callId)
        }

        if (sessionId) {
            emitSessionEvent(sessionId, { type: "tool_call_completed", toolCallCompleted: JSON.stringify({ tool: toolName, status: "failed", error: message }) })
        }

        return res.status(500).json({ success: false, error: message })
    }
}

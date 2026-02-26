import { FunctionTool, type RunContext } from "@openai/agents"
import { Request, Response } from "express"
import { z } from "zod"

import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner"
import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { User } from "../shared/types"
import { Session } from "../types/session"

type SdkFunctionTool = FunctionTool<SessionWithTracking<Session>, z.ZodObject<any>, unknown>

/**
 * Finds a tool by name across all registered Output toolboxes.
 * Iterates OutputFactory.OUTPUT_REGISTRY, instantiates each Output, and searches their toolboxes.
 */
function findToolByName(toolName: string): SdkFunctionTool | null {
    for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
        const output = factory()
        for (const entry of output.toolbox) {
            if (entry.tool.name === toolName) {
                return entry.tool as SdkFunctionTool
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

    const tool = findToolByName(toolName)
    if (!tool) {
        return res.status(404).json({ success: false, error: `Tool "${toolName}" not found` })
    }

    const runContextPayload = {
        context: {
            user,
            isUserInitiated: true,
            agent: { requireApproval: false, toolApprovals: [] },
            runId: `sdk-tool-execute-${Date.now()}`,
            agentId: "sdk-tool-execute"
        } satisfies SessionWithTracking<Session>
    }

    try {
        // OpenAI's invoke API expects a concrete RunContext class instance with private fields.
        // We only need the user context for our tools, so we bridge with a narrow cast at this boundary.
        const invokeContext = runContextPayload as unknown as RunContext<SessionWithTracking<Session>>
        const rawResult = await tool.invoke(invokeContext, JSON.stringify(params ?? {}))
        const result = normalizeInvokedToolResult(rawResult)
        return res.json({ success: true, result })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error("[sdk/tool-execute] Tool execution failed", { toolName, error: message })
        return res.status(500).json({ success: false, error: message })
    }
}

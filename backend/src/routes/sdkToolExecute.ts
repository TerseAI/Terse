import { FunctionTool } from "@openai/agents"
import { Request, Response } from "express"

import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner"
import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { User } from "../shared/types"
import { Session } from "../types/session"

/**
 * Finds a tool by name across all registered Output toolboxes.
 * Iterates OutputFactory.OUTPUT_REGISTRY, instantiates each Output, and searches their toolboxes.
 */
function findToolByName(toolName: string): FunctionTool | null {
    for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
        const output = factory()
        for (const entry of output.toolbox) {
            if (entry.tool.name === toolName) {
                return entry.tool as FunctionTool
            }
        }
    }
    return null
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

    const runContext = {
        context: {
            user,
            isUserInitiated: true,
            agent: { requireApproval: false, toolApprovals: [] }
        } satisfies SessionWithTracking<Session>
    }

    try {
        const result = await tool.invoke(runContext as any, JSON.stringify(params ?? {}))
        return res.json({ success: true, result })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error("[sdk/tool-execute] Tool execution failed", { toolName, error: message })
        return res.status(500).json({ success: false, error: message })
    }
}

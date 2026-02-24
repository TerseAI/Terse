import { FunctionTool } from "@openai/agents"
import { Request, Response } from "express"

import logger from "../logger"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { IntegrationType } from "../shared/Integrations"
import { User } from "../shared/types"

/**
 * GET /sdk/tool-definitions
 *
 * Returns metadata for all registered tools across all Output toolboxes.
 * The CLI uses this to generate typed tool wrappers.
 */
export async function handleToolDefinitions(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const tools: Array<{
            name: string
            displayName: string
            description: string
            integration: string
            isReadOnly: boolean
            parameters: Record<string, unknown>
        }> = []

        const seen = new Set<string>()

        // Limit to Slack and GitHub while we validate the architecture
        const allowedIntegrations = new Set<string>([IntegrationType.SLACK, IntegrationType.GITHUB])

        for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
            const output = factory()
            for (const entry of output.toolbox) {
                if (!allowedIntegrations.has(entry.integration)) continue

                const name = entry.tool.name
                if (seen.has(name)) continue
                seen.add(name)

                const ft = entry.tool as FunctionTool
                tools.push({
                    name,
                    displayName: entry.displayName,
                    description: ft.description ?? "",
                    integration: entry.integration,
                    isReadOnly: entry.isReadOnly,
                    parameters: ft.parameters as Record<string, unknown>
                })
            }
        }

        return res.json({ tools })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error("[sdk/tool-definitions] Failed to collect tool definitions", { error: message })
        return res.status(500).json({ error: "Failed to collect tool definitions" })
    }
}

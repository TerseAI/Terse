import { RunContext, ToolOptions, UnknownContext } from "@openai/agents"
import { ToolDefinitions, ToolInputByName, ToolInputSchemaByName, ToolName, ToolOutputByName } from "terse-types"

import { SessionWithTracking } from "../agent/AgentRunner/BaseAgentRunner"
import { Session } from "../express"
import logger from "../common/logger"

// Extend OpenAI's ToolOptions — override execute to enforce output type
export type TypedToolOptions<TName extends ToolName, Context = UnknownContext> = Omit<ToolOptions<ToolInputSchemaByName[TName], Context>, "execute" | "name" | "parameters" | "strict"> & {
    name: TName
    parameters: ToolInputSchemaByName[TName]
    strict?: true
    execute: (input: ToolInputByName[TName], context?: RunContext<Context>) => Promise<ToolOutputByName[TName]> | ToolOutputByName[TName]
}

type ToolDefinitionInput<TName extends ToolName, Context = UnknownContext> = Omit<TypedToolOptions<TName, Context>, "parameters">

export function defineTool<TName extends ToolName, Context = UnknownContext>(tool: ToolDefinitionInput<TName, Context>): TypedToolOptions<TName, Context> {
    return { ...tool, parameters: ToolDefinitions[tool.name].inputSchema, strict: true } as TypedToolOptions<TName, Context>
}

export function defineSessionTool<TName extends ToolName, Context = SessionWithTracking<Session>>(tool: ToolDefinitionInput<TName, Context>): TypedToolOptions<TName, Context> {
    return defineTool(tool)
}

// MARK: - Error Handling

export async function formatError(context: RunContext, error: Error | unknown): Promise<string> {
    return JSON.stringify({
        text: `[TERSE ERROR]:${JSON.stringify({ error: error instanceof Error ? error.message : error })}`,
        success: false
    })
}

export function detectSerializedError(error: string): boolean {
    return error.startsWith("[TERSE ERROR]:")
}

export function parseSerializedError(error: string): ErrorContext {
    try {
        // Strip the [TERSE ERROR]: prefix before parsing
        const prefix = "[TERSE ERROR]:"
        const jsonString = error.startsWith(prefix) ? error.slice(prefix.length) : error

        const errorJson = JSON.parse(jsonString)
        return {
            context: errorJson.context as RunContext,
            error: errorJson.error as string | unknown
        }
    } catch (parseError) {
        const errorPreview = error.length > 50 ? error.substring(0, 50) + "..." : error
        logger.error("Failed to parse serialized error", {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            stack: parseError instanceof Error ? parseError.stack : undefined,
            errorPreview
        })
        return {
            context: {} as RunContext,
            error: `Unable to parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        }
    }
}

export type ErrorContext = {
    context: RunContext
    error: string | unknown
}

// MARK: - Approval

/**
 * Creates a needsApproval function for a specific tool.
 * This function matches the OpenAI Agents SDK signature: (context, args) => Promise<boolean>
 */
export function createNeedsApprovalFunction(toolName: string) {
    return async (context?: RunContext<unknown>, _args?: unknown): Promise<boolean> => {
        // Type guard: safely access agent from SessionWithTracking
        const sessionWithTracking = context?.context as SessionWithTracking<Session> | undefined
        const agent = sessionWithTracking?.agent

        if (!agent) return false

        // Check granular settings first (new system)
        // If toolApprovals is defined (even if empty array), use granular system
        // Empty array means user explicitly selected no tools to require approval
        if (toolName && agent.toolApprovals !== undefined) {
            return agent.toolApprovals.includes(toolName)
        }

        // Fallback to legacy boolean (backward compatibility)
        // Only used when toolApprovals is undefined (not set)
        return false
    }
}

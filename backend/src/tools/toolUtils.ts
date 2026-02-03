import { RunContext } from "@openai/agents"

import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner"
import logger from "../logger"
import { Session } from "../types/session"

// MARK: - Error Handling

export async function formatError(context: RunContext, error: Error | unknown): Promise<string> {
    return `[TERSE ERROR]:${JSON.stringify({ context, error: error instanceof Error ? error.message : error })}`
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
        return agent.requireApproval ?? false
    }
}

/**
 * Legacy function for backward compatibility.
 * @deprecated Use createNeedsApprovalFunction instead
 */
export async function needsApproval(context?: RunContext<unknown>): Promise<boolean> {
    // Type guard: safely access agent.requireApproval from SessionWithTracking
    const sessionWithTracking = context?.context as SessionWithTracking<Session> | undefined
    return sessionWithTracking?.agent?.requireApproval ?? false
}

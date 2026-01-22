import { RunContext } from "@openai/agents";
import { Session } from "../server";
import { SessionWithTracking } from "../agent/AgentRunner/AgentRunner";
import logger from "../logger";

// MARK: - Error Handling

export async function formatError(context: RunContext, error: Error | unknown) : Promise<string> {
    return `[TERSE ERROR]:${JSON.stringify({context, error: error instanceof Error ? error.message : error})}`;
}


export function detectSerializedError(error: string): boolean {
    return error.startsWith("[TERSE ERROR]:");
}


export function parseSerializedError(error: string): ErrorContext {
    try {
        // Strip the [TERSE ERROR]: prefix before parsing
        const prefix = "[TERSE ERROR]:";
        const jsonString = error.startsWith(prefix)
            ? error.slice(prefix.length)
            : error;

        const errorJson = JSON.parse(jsonString)
        return {
            context: errorJson.context as RunContext,
            error: errorJson.error as string | unknown,
        }
    } catch (parseError) {
        const errorPreview = error.length > 50 ? error.substring(0, 50) + "..." : error;
        logger.error("Failed to parse serialized error", { error: parseError instanceof Error ? parseError.message : String(parseError), stack: parseError instanceof Error ? parseError.stack : undefined, errorPreview });
        return {
            context: {} as RunContext,
            error: `Unable to parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        }
    }
}


export type ErrorContext = {
    context: RunContext;
    error: string | unknown;
}

// MARK: - Approval

export async function needsApproval(
    context?: RunContext<unknown>,
    toolName?: string
): Promise<boolean> {
    // Type guard: safely access agent.requireApproval from SessionWithTracking
    const sessionWithTracking = context?.context as SessionWithTracking<Session> | undefined;
    const agent = sessionWithTracking?.agent;
    
    if (!agent) {
        return false;
    }

    // If toolApprovals is defined and has items, check if this tool requires approval
    if (toolName && agent.toolApprovals && agent.toolApprovals.length > 0) {
        return agent.toolApprovals.includes(toolName);
    }

    // Fall back to requireApproval flag for backward compatibility
    return agent.requireApproval ?? false;
}

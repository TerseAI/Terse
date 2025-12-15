import { RunContext } from "@openai/agents";
import { Session } from "../server";
import { SessionWithTracking } from "../agent/ChannelAgent/ChannelAgent";

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
        console.error("Failed to parse serialized error:", parseError);
        console.error("Error string preview:", errorPreview);
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

// needsApproval function that matches ToolApprovalFunction signature
// The library expects RunContext<unknown>, but we know it's actually SessionWithTracking
export async function needsApproval(context?: RunContext<unknown>): Promise<boolean> {
    // Type guard: safely access channel.requireApproval from SessionWithTracking
    const sessionWithTracking = context?.context as SessionWithTracking<Session> | undefined;
    return sessionWithTracking?.channel?.requireApproval ?? false;
}


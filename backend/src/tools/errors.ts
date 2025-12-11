import { RunContext } from "@openai/agents";


/**
 * Expected signature for errorFunction in a tool using OpenAI Agents SDK
 */
export async function formatError(context: RunContext, error: Error | unknown) : Promise<string> {
    return `[TERSE ERROR]:${JSON.stringify({context, error: error instanceof Error ? error.message : error})}`;
}

/**
 * OpenAI Agents SDK only supports string errors. We need to detect if the error is serialized so we can parse it.
 */
export function detectSerializedError(error: string): boolean {
    return error.startsWith("[TERSE ERROR]:");
}

/**
 * Parse a serialized error into an ErrorContext.
 * The error string should be in the format: [TERSE ERROR]:{"context": {...}, "error": "..."}
 */
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

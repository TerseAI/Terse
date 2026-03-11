import logger from "../logger"
import { ChatSnippet, ToolCallExecutionStatus } from "../shared/ModelEvents"
import { RunHistoryAction } from "../shared/RunHistoryTypes"
import { ErrorContext, detectSerializedError, parseSerializedError } from "../tools/toolUtils"

import { chatSnippetPayloadSchema } from "./systemEvents/snippetSystemEvent"

type ToolExecutionParseResult = {
    status: ToolCallExecutionStatus
    output: object
    errorContext?: ErrorContext
    actions?: RunHistoryAction[]
    snippets?: ChatSnippet[]
}

export function isFailedToolExecutionStatus(status: ToolCallExecutionStatus): boolean {
    return status === ToolCallExecutionStatus.INCOMPLETE || status === ToolCallExecutionStatus.FAILED
}

export function parseToolExecutionResult(rawOutput: unknown, rawStatus: ToolCallExecutionStatus): ToolExecutionParseResult {
    const output = standardizeToolOutputToObject(rawOutput)
    const errorContext = extractToolExecutionErrorContext(output, rawStatus)
    const actions = extractToolExecutionActions(output)
    const snippets = extractToolExecutionSnippets(output)
    return {
        status: rawStatus,
        output,
        errorContext,
        actions,
        snippets
    }
}

/**
 * Attempts to standardize output from tool to object. Based on upstream code, object
 * can come through as:
 * 1) String
 * 2) JSON String representation
 * 3) void/undefined
 */
function standardizeToolOutputToObject(rawOutput: unknown): object {
    if (!rawOutput) return {}
    if (typeof rawOutput === "object" && "text" in rawOutput && typeof rawOutput.text === "string") {
        const trimmed = rawOutput.text.trimStart()
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
                return JSON.parse(rawOutput.text)
            } catch (error) {
                logger.warn(`Error parsing tool call output error:${error} output:${rawOutput}`)
            }
        }
    }
    if (typeof rawOutput === "object") {
        return rawOutput
    }
    if (typeof rawOutput === "string") {
        try {
            return JSON.parse(rawOutput)
        } catch {
            return { text: rawOutput }
        }
    }
    return {}
}

function extractToolExecutionActions(output: unknown): RunHistoryAction[] | undefined {
    if (!output || typeof output !== "object") {
        return undefined
    }

    const candidate = output as { actions?: unknown }
    return Array.isArray(candidate.actions) ? (candidate.actions as RunHistoryAction[]) : undefined
}

function extractToolExecutionSnippets(output: unknown): ChatSnippet[] {
    if (!output || typeof output !== "object") {
        return []
    }

    const candidate = output as { snippets?: unknown; snippet?: unknown }

    if (Array.isArray(candidate.snippets)) {
        const parsedSnippets: ChatSnippet[] = []
        for (const snippet of candidate.snippets) {
            const parsedSnippet = chatSnippetPayloadSchema.safeParse(snippet)
            if (!parsedSnippet.success) {
                continue
            }
            parsedSnippets.push(parsedSnippet.data)
        }
        return parsedSnippets
    }

    if (candidate.snippet !== undefined) {
        const parsedSnippet = chatSnippetPayloadSchema.safeParse(candidate.snippet)
        if (parsedSnippet.success) {
            return [parsedSnippet.data]
        }
    }

    return []
}

function extractStructuredFailure(output: unknown): ErrorContext | undefined {
    if (!output || typeof output !== "object") {
        return undefined
    }

    const candidate = output as Record<string, unknown>
    const explicitlyFailed = candidate.success === false
    if (!explicitlyFailed) {
        return undefined
    }

    const rawError = candidate.text
    if (typeof rawError === "string" && detectSerializedError(rawError)) {
        return parseSerializedError(rawError)
    }

    return {
        context: {} as any,
        error: rawError
    }
}

function extractToolExecutionErrorContext(output: unknown, status: ToolCallExecutionStatus): ErrorContext | undefined {
    const structuredFailure = extractStructuredFailure(output)
    if (structuredFailure) {
        return structuredFailure
    }

    if (isFailedToolExecutionStatus(status)) {
        return {
            context: {} as any,
            error: JSON.stringify(output) ?? `Tool failed with status: ${status}`
        }
    }

    // Detect OpenAI SDK-wrapped tool errors: { type: "text", text: "An error occurred..." }
    if (typeof output === "object" && output !== null && "type" in output && "text" in output) {
        const candidate = output as { type: unknown; text: unknown }
        if (candidate.type === "text" && typeof candidate.text === "string" && candidate.text.includes("Error:")) {
            return {
                context: {} as any,
                error: candidate.text
            }
        }
    }

    return undefined
}

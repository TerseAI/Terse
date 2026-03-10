import logger from "../logger"
import { ChatSnippet, ToolCallExecutionStatus } from "../shared/ModelEvents"
import { RunHistoryAction } from "../shared/RunHistoryTypes"
import { ErrorContext, detectSerializedError, parseSerializedError } from "../tools/toolUtils"

import { chatSnippetPayloadSchema } from "./systemEvents/snippetSystemEvent"

type ToolExecutionParseResult = {
    status: ToolCallExecutionStatus
    output: object
    outputString: string | null
    errorContext?: ErrorContext
    actions?: RunHistoryAction[]
    snippets?: ChatSnippet[]
}

const FALLBACK_FAILURE_MESSAGE = "Tool returned success=false"

export function normalizeToolExecutionStatus(status: unknown): ToolCallExecutionStatus {
    if (status === ToolCallExecutionStatus.COMPLETED || status === ToolCallExecutionStatus.INCOMPLETE || status === ToolCallExecutionStatus.FAILED) {
        return status
    }
    return ToolCallExecutionStatus.UNKNOWN
}

export function isFailedToolExecutionStatus(status: ToolCallExecutionStatus): boolean {
    return status === ToolCallExecutionStatus.INCOMPLETE || status === ToolCallExecutionStatus.FAILED
}

export function parseToolExecutionResult(rawOutput: unknown, rawStatus: unknown): ToolExecutionParseResult {
    const status = normalizeToolExecutionStatus(rawStatus)
    const output = normalizeToolExecutionOutput(rawOutput)
    const outputString = stringifyToolExecutionOutput(output)
    const errorContext = extractToolExecutionErrorContext(output, outputString, status)
    const actions = extractToolExecutionActions(output)
    const snippets = extractToolExecutionSnippets(output)

    return {
        status,
        output,
        outputString,
        ...(errorContext ? { errorContext } : {}),
        ...(actions ? { actions } : {}),
        ...(snippets ? { snippets } : {})
    }
}

function normalizeToolExecutionOutput(rawOutput: unknown): object {
    // There may be a field called text in rawOutput
    if (typeof rawOutput === "object" && rawOutput && "text" in rawOutput && typeof rawOutput.text === "string") {
        try {
            const objectOutput = JSON.parse(rawOutput.text)
            return objectOutput
        } catch (error) {
            logger.warn("Error parsing tool call output")
        }
    } else if (typeof rawOutput === "object" && rawOutput) {
        return rawOutput
    }
    return {}
}

function stringifyToolExecutionOutput(output: unknown): string | null {
    if (typeof output === "string") return output
    if (output === null || output === undefined) return null

    try {
        return JSON.stringify(output)
    } catch {
        return null
    }
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
    const explicitlyFailed = candidate.success === false || candidate.ok === false
    if (!explicitlyFailed) {
        return undefined
    }

    const rawError = candidate.error ?? candidate.message ?? FALLBACK_FAILURE_MESSAGE
    if (typeof rawError === "string" && detectSerializedError(rawError)) {
        return parseSerializedError(rawError)
    }

    return {
        context: {} as any,
        error: rawError
    }
}

function extractToolExecutionErrorContext(output: unknown, outputString: string | null, status: ToolCallExecutionStatus): ErrorContext | undefined {
    const structuredFailure = extractStructuredFailure(output)
    if (structuredFailure) {
        return structuredFailure
    }

    if (outputString && detectSerializedError(outputString)) {
        return parseSerializedError(outputString)
    }

    if (isFailedToolExecutionStatus(status)) {
        return {
            context: {} as any,
            error: outputString ?? `Tool failed with status: ${status}`
        }
    }

    return undefined
}

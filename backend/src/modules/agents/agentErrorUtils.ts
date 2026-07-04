import type { ModelEvent } from "terse-types/ModelEvents"

import { extractErrorMessage } from "../../common/strings"

/**
 * Normalizes thrown agent/runner errors and returns a stable message plus optional code
 * for specific UI handling (e.g. context_length_exceeded).
 */

export type ClassifiedError = { message: string; code?: string }

/**
 * Build a RunError ModelEvent from a classified error. Single source of truth for the event shape.
 */
export function buildRunErrorEvent(classified: ClassifiedError): ModelEvent {
    const id = `run-error-${Date.now()}`
    return {
        type: "RunError",
        id,
        response_id: id,
        timestamp: Date.now(),
        error: classified.message,
        ...(classified.code && { code: classified.code })
    }
}

const CONTEXT_LENGTH_CODE = "context_length_exceeded"

function isContextLengthError(error: unknown): boolean {
    const msg = extractErrorMessage(error).toLowerCase()
    if (
        msg.includes("context length") ||
        msg.includes("maximum context") ||
        msg.includes("max token") ||
        msg.includes("context_length_exceeded") ||
        msg.includes("token limit") ||
        msg.includes("exceeds the context window")
    ) {
        return true
    }
    const any = error as Record<string, unknown> | null | undefined
    if (any && typeof any === "object") {
        const code = (any.code ?? (any as { error?: { code?: string } }).error?.code) as string | undefined
        if (code === "context_length_exceeded" || code === "context_length_exceeded_error") {
            return true
        }
    }
    return false
}

/**
 * Classify an error thrown from agent/runner execution.
 * Returns { message, code? } for logging and for RunError events.
 */
export function classifyAgentError(error: unknown): ClassifiedError {
    const message = extractErrorMessage(error)
    if (isContextLengthError(error)) {
        return { message, code: CONTEXT_LENGTH_CODE }
    }
    return { message }
}

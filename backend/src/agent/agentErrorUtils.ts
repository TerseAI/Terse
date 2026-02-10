import type { ModelEvent } from "../shared/ModelEvents"

/**
 * Normalizes thrown agent/runner errors and returns a stable message plus optional code
 * for specific UI handling (e.g. context_length_exceeded).
 */

export type ClassifiedError = { message: string; code?: string }

/**
 * Build a RunError ModelEvent from a classified error. Single source of truth for the event shape.
 */
export function buildRunErrorEvent(classified: ClassifiedError): ModelEvent {
    return {
        type: "RunError",
        error: classified.message,
        ...(classified.code && { code: classified.code })
    }
}

const CONTEXT_LENGTH_CODE = "context_length_exceeded"

function normalizeMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    return String(error)
}

function isContextLengthError(error: unknown): boolean {
    const msg = normalizeMessage(error).toLowerCase()
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
    const message = normalizeMessage(error)
    if (isContextLengthError(error)) {
        return { message, code: CONTEXT_LENGTH_CODE }
    }
    return { message }
}

/**
 * Context Window Error Handling
 *
 * This module provides utilities for detecting, handling, and recovering from
 * context window exceeded errors when calling LLM APIs.
 */

import logger from "../logger"

// Error codes that indicate context window issues
const CONTEXT_WINDOW_ERROR_CODES = [
    "context_length_exceeded",
    "max_tokens_exceeded",
    "invalid_request_error", // OpenAI uses this for context limit issues
    "model_max_length_exceeded"
]

// Error message patterns that indicate context window issues
const CONTEXT_WINDOW_ERROR_PATTERNS = [
    /context.*(window|length).*exceeded/i,
    /maximum.*(context|token).*length/i,
    /input.*too.*long/i,
    /exceeds.*maximum.*tokens/i,
    /reduce.*input.*length/i,
    /model's maximum context length/i,
    /request resulted in too many tokens/i,
    /prompt is too long/i
]

export type ContextWindowErrorSource = "github" | "tool_output" | "conversation_history" | "system_prompt" | "unknown"

export interface ContextWindowErrorDetails {
    source: ContextWindowErrorSource
    estimatedTokens?: number
    maxAllowedTokens?: number
    toolName?: string
    retryCount: number
    originalError: Error | unknown
}

export class ContextWindowError extends Error {
    public readonly isContextWindowError = true
    public readonly details: ContextWindowErrorDetails

    constructor(message: string, details: ContextWindowErrorDetails) {
        super(message)
        this.name = "ContextWindowError"
        this.details = details

        // Maintain proper stack trace for V8 engines
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ContextWindowError)
        }
    }

    /**
     * Creates a user-friendly message suitable for UI display
     */
    getUserMessage(): string {
        const sourceMessages: Record<ContextWindowErrorSource, string> = {
            github: "The GitHub data (events, diffs, or PR content) was too large to process.",
            tool_output: `The output from tool "${this.details.toolName || "unknown"}" exceeded the context limit.`,
            conversation_history: "The conversation history has grown too long.",
            system_prompt: "The system configuration exceeded the context limit.",
            unknown: "The request exceeded the model's context window."
        }

        return sourceMessages[this.details.source]
    }

    /**
     * Creates guidance for the user on how to proceed
     */
    getUserGuidance(): string {
        const sourceGuidance: Record<ContextWindowErrorSource, string> = {
            github: "Try narrowing your request:\n- Ask about a specific file or commit instead of an entire PR\n- Filter to recent events only\n- Request a summary instead of full details",
            tool_output: "Try a more specific query that returns fewer results.",
            conversation_history: "Start a new conversation to continue.",
            system_prompt: "Contact support - the agent configuration may need adjustment.",
            unknown: "Try breaking your request into smaller parts."
        }

        return sourceGuidance[this.details.source]
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            userMessage: this.getUserMessage(),
            userGuidance: this.getUserGuidance(),
            details: {
                source: this.details.source,
                estimatedTokens: this.details.estimatedTokens,
                maxAllowedTokens: this.details.maxAllowedTokens,
                toolName: this.details.toolName,
                retryCount: this.details.retryCount
            }
        }
    }
}

/**
 * Detects if an error is a context window exceeded error
 */
export function isContextWindowError(error: unknown): boolean {
    if (!error) return false

    // Check if it's already a ContextWindowError
    if (error instanceof ContextWindowError) return true

    const errorMessage = getErrorMessage(error)
    const errorCode = getErrorCode(error)

    // Check error code
    if (errorCode && CONTEXT_WINDOW_ERROR_CODES.some(code => errorCode.toLowerCase().includes(code.toLowerCase()))) {
        return true
    }

    // Check error message patterns
    if (errorMessage && CONTEXT_WINDOW_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage))) {
        return true
    }

    return false
}

/**
 * Wraps an error as a ContextWindowError if it matches the criteria
 */
export function wrapAsContextWindowError(error: unknown, partialDetails?: Partial<ContextWindowErrorDetails>): ContextWindowError {
    if (error instanceof ContextWindowError) {
        return error
    }

    const errorMessage = getErrorMessage(error)
    const source = inferErrorSource(error, partialDetails?.toolName)

    // Try to extract token counts from the error message
    const tokenInfo = extractTokenInfo(errorMessage)

    const details: ContextWindowErrorDetails = {
        source,
        estimatedTokens: tokenInfo.estimatedTokens ?? partialDetails?.estimatedTokens,
        maxAllowedTokens: tokenInfo.maxAllowedTokens ?? partialDetails?.maxAllowedTokens,
        toolName: partialDetails?.toolName,
        retryCount: partialDetails?.retryCount ?? 0,
        originalError: error
    }

    return new ContextWindowError(`Context window exceeded: ${errorMessage}`, details)
}

/**
 * Infers the source of a context window error based on available context
 */
function inferErrorSource(error: unknown, toolName?: string): ContextWindowErrorSource {
    const errorMessage = getErrorMessage(error)

    // Check for GitHub-related keywords
    if (
        errorMessage &&
        (errorMessage.toLowerCase().includes("github") ||
            errorMessage.toLowerCase().includes("pull request") ||
            errorMessage.toLowerCase().includes("diff") ||
            errorMessage.toLowerCase().includes("commit"))
    ) {
        return "github"
    }

    // If a tool name was provided, it's likely from tool output
    if (toolName) {
        if (toolName.toLowerCase().includes("github")) {
            return "github"
        }
        return "tool_output"
    }

    return "unknown"
}

/**
 * Extracts token information from error messages
 */
function extractTokenInfo(errorMessage: string | null): { estimatedTokens?: number; maxAllowedTokens?: number } {
    if (!errorMessage) return {}

    const result: { estimatedTokens?: number; maxAllowedTokens?: number } = {}

    // Pattern: "resulted in X tokens" or "X tokens"
    const tokenMatch = errorMessage.match(/(\d+)\s*tokens/i)
    if (tokenMatch) {
        result.estimatedTokens = parseInt(tokenMatch[1], 10)
    }

    // Pattern: "maximum context length is X" or "max X tokens"
    const maxMatch = errorMessage.match(/max(?:imum)?\s*(?:context\s*)?(?:length\s*(?:is|of))?\s*(\d+)/i)
    if (maxMatch) {
        result.maxAllowedTokens = parseInt(maxMatch[1], 10)
    }

    return result
}

/**
 * Safely extracts an error message from any error type
 */
function getErrorMessage(error: unknown): string | null {
    if (!error) return null

    if (typeof error === "string") return error

    if (error instanceof Error) return error.message

    if (typeof error === "object" && error !== null) {
        const obj = error as Record<string, unknown>
        if (typeof obj.message === "string") return obj.message
        if (typeof obj.error === "string") return obj.error
        if (typeof obj.error === "object" && obj.error !== null) {
            const innerError = obj.error as Record<string, unknown>
            if (typeof innerError.message === "string") return innerError.message
        }
    }

    return String(error)
}

/**
 * Safely extracts an error code from any error type
 */
function getErrorCode(error: unknown): string | null {
    if (!error || typeof error !== "object") return null

    const obj = error as Record<string, unknown>

    if (typeof obj.code === "string") return obj.code
    if (typeof obj.type === "string") return obj.type

    if (typeof obj.error === "object" && obj.error !== null) {
        const innerError = obj.error as Record<string, unknown>
        if (typeof innerError.code === "string") return innerError.code
        if (typeof innerError.type === "string") return innerError.type
    }

    return null
}

/**
 * Logs a context window error with consistent telemetry format
 */
export function logContextWindowError(
    error: ContextWindowError,
    additionalContext: {
        runId?: string
        agentId?: string
        userId?: string
        organizationId?: string
        model?: string
    }
): void {
    logger.error("context_window_exceeded", {
        error: error.message,
        errorSource: error.details.source,
        estimatedTokens: error.details.estimatedTokens,
        maxAllowedTokens: error.details.maxAllowedTokens,
        toolName: error.details.toolName,
        retryCount: error.details.retryCount,
        runId: additionalContext.runId,
        agentId: additionalContext.agentId,
        userId: additionalContext.userId,
        organizationId: additionalContext.organizationId,
        model: additionalContext.model
    })
}

// Maximum number of retries before giving up
export const MAX_CONTEXT_WINDOW_RETRIES = 2

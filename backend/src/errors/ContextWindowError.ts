import logger from "../logger"

/**
 * Maximum number of retries when hitting context window limits
 * before transitioning to a terminal failure state
 */
export const MAX_CONTEXT_WINDOW_RETRIES = 3

/**
 * Details about the context window error
 */
interface ContextWindowErrorDetails {
    source: string
    userMessage: string
    userGuidance: string
    isRecoverable: boolean
}

/**
 * Custom error class for context window exceeded errors.
 * Contains user-friendly messages and guidance for recovery.
 */
export class ContextWindowError extends Error {
    public readonly details: ContextWindowErrorDetails
    public readonly originalError?: Error

    constructor(options: { message: string; userMessage?: string; userGuidance?: string; isRecoverable?: boolean; source?: string; originalError?: Error }) {
        super(options.message)
        this.name = "ContextWindowError"
        this.details = {
            source: options.source || "unknown",
            userMessage: options.userMessage || "The conversation has grown too large for the AI to process. This can happen with very long conversations or when working with large files.",
            userGuidance: options.userGuidance || "Try one of these:\n• Start a new conversation for this task\n• Break your request into smaller parts\n• Ask me to summarize and continue",
            isRecoverable: options.isRecoverable ?? true
        }
        this.originalError = options.originalError
    }

    /**
     * Returns the user-friendly error message
     */
    getUserMessage(): string {
        return this.details.userMessage
    }

    /**
     * Returns the guidance for the user on how to proceed
     */
    getUserGuidance(): string {
        return this.details.userGuidance
    }
}

/**
 * Checks if an error is a context window exceeded error.
 * Detects various error formats from different AI providers.
 */
export function isContextWindowError(error: unknown): boolean {
    if (error instanceof ContextWindowError) {
        return true
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    const lowerMessage = errorMessage.toLowerCase()

    // Common patterns for context window errors across providers
    const contextWindowPatterns = [
        "context_length_exceeded",
        "context window",
        "context length",
        "maximum context",
        "token limit",
        "max_tokens",
        "too many tokens",
        "input too long",
        "request too large",
        "message is too long",
        "exceeds the model's maximum context"
    ]

    return contextWindowPatterns.some(pattern => lowerMessage.includes(pattern))
}

/**
 * Wraps a generic error as a ContextWindowError with appropriate metadata.
 */
export function wrapAsContextWindowError(error: unknown, source?: string): ContextWindowError {
    if (error instanceof ContextWindowError) {
        return error
    }

    const originalError = error instanceof Error ? error : new Error(String(error))
    const detectedSource = source || detectErrorSource(originalError)

    return new ContextWindowError({
        message: originalError.message,
        userMessage: getUserMessageForSource(detectedSource),
        userGuidance: getGuidanceForSource(detectedSource),
        isRecoverable: true,
        source: detectedSource,
        originalError
    })
}

/**
 * Context for logging context window errors
 */
interface LogContextWindowErrorContext {
    runId?: string
    stepId?: string
    attemptNumber?: number
    agentId?: string
    userId?: string
    organizationId?: string
}

/**
 * Logs a context window error with consistent telemetry key for PostHog.
 */
export function logContextWindowError(error: ContextWindowError, context: LogContextWindowErrorContext = {}): void {
    logger.warn("Context window exceeded", {
        // PostHog searchable key
        context_window_exceeded: true,
        error_message: error.message,
        user_message: error.details.userMessage,
        source: error.details.source,
        is_recoverable: error.details.isRecoverable,
        run_id: context.runId,
        step_id: context.stepId,
        attempt_number: context.attemptNumber,
        agent_id: context.agentId,
        user_id: context.userId,
        organization_id: context.organizationId,
        original_error: error.originalError?.message
    })
}

/**
 * Detects the likely source of a context window error based on error content.
 */
function detectErrorSource(error: Error): string {
    const message = error.message.toLowerCase()

    if (message.includes("github") || message.includes("repository") || message.includes("pull request") || message.includes("issue")) {
        return "github"
    }

    if (message.includes("tool") || message.includes("function")) {
        return "tool_output"
    }

    if (message.includes("conversation") || message.includes("history") || message.includes("messages")) {
        return "conversation_history"
    }

    return "unknown"
}

/**
 * Returns a user-friendly message based on the error source.
 */
function getUserMessageForSource(source: string): string {
    switch (source) {
        case "github":
            return "The GitHub data (issues, PRs, or files) is too large to process in a single request."
        case "tool_output":
            return "A tool returned too much data to process at once."
        case "conversation_history":
            return "This conversation has grown too long to continue processing."
        default:
            return "The request exceeded the AI's context limit."
    }
}

/**
 * Returns guidance based on the error source.
 */
function getGuidanceForSource(source: string): string {
    switch (source) {
        case "github":
            return "Try:\n• Requesting specific files instead of entire repositories\n• Filtering issues/PRs by date range or status\n• Asking for summaries instead of full content"
        case "tool_output":
            return "Try:\n• Breaking the task into smaller parts\n• Asking for specific sections of the output\n• Requesting a summary instead"
        case "conversation_history":
            return "Try:\n• Starting a new conversation for this task\n• Asking me to summarize our progress so far\n• Breaking your request into separate conversations"
        default:
            return "Try:\n• Starting a new conversation\n• Breaking your request into smaller parts\n• Asking for summaries instead of full details"
    }
}

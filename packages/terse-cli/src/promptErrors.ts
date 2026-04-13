const PROMPT_CANCELLATION_ERROR_NAMES = new Set(["AbortPromptError", "CancelPromptError", "ExitPromptError"])

export function isPromptCancellationError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false

    const { name } = error as { name?: unknown }
    return typeof name === "string" && PROMPT_CANCELLATION_ERROR_NAMES.has(name)
}

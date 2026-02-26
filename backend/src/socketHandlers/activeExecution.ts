export type ActiveExecution = {
    controller: AbortController
    cancelRequested: boolean
}

export type CancelAckResponse = {
    accepted: boolean
    reason?: string
}

export const USER_CANCELLED_REASON = "Run cancelled by user"

export function createActiveExecution(): ActiveExecution {
    return {
        controller: new AbortController(),
        cancelRequested: false
    }
}

export function clearActiveExecution(registry: Map<string, ActiveExecution>, key: string, activeExecution: ActiveExecution): void {
    const currentExecution = registry.get(key)
    if (currentExecution === activeExecution) {
        registry.delete(key)
    }
}

export function cancelActiveExecution(activeExecution: ActiveExecution): void {
    activeExecution.cancelRequested = true
    activeExecution.controller.abort("user_cancelled")
}

export function isAbortLikeError(error: unknown): boolean {
    if (!error) return false
    if (error instanceof Error && error.name === "AbortError") return true

    const anyError = error as { name?: unknown; code?: unknown; message?: unknown }
    if (anyError?.name === "AbortError") return true
    if (typeof anyError?.code === "string" && anyError.code.toLowerCase().includes("abort")) return true
    if (typeof anyError?.message === "string" && anyError.message.toLowerCase().includes("abort")) return true
    return false
}

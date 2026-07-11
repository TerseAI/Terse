export type PollUntilOptions = {
    intervalMs: number
    /** Stop and return null once this much time has passed. Omit to poll until attempt() produces a value. */
    timeoutMs?: number
    /** Rethrow once attempt() has been failing continuously for this long. Omit to treat errors as pending. */
    errorToleranceMs?: number
}

// The one polling loop: attempt() returns undefined while pending, a value when done.
// Transient attempt() errors count as pending so a network blip never kills a wait,
// bounded by errorToleranceMs for waits that must not spin on a persistent failure.
export async function pollUntil<T>(attempt: () => Promise<T | undefined>, options: PollUntilOptions): Promise<T | null> {
    const startedAt = Date.now()
    let failingSince: number | null = null

    while (true) {
        try {
            const result = await attempt()
            if (result !== undefined) return result
            failingSince = null
        } catch (error) {
            failingSince ??= Date.now()
            if (options.errorToleranceMs !== undefined && Date.now() - failingSince >= options.errorToleranceMs) {
                throw error
            }
        }

        if (options.timeoutMs !== undefined && Date.now() - startedAt >= options.timeoutMs) return null
        await new Promise(resolve => setTimeout(resolve, options.intervalMs))
    }
}

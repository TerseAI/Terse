export abstract class LatencyTelemetry<TDurationKey extends string> {
    private readonly startedAt = performance.now()

    protected readonly durations: Partial<Record<TDurationKey, number>> = {}

    setDuration(key: TDurationKey, durationMs: number): void {
        if (Number.isFinite(durationMs)) {
            this.durations[key] = Math.max(0, Math.round(durationMs))
        }
    }

    addDuration(key: TDurationKey, durationMs: number): void {
        if (Number.isFinite(durationMs)) {
            this.setDuration(key, (this.durations[key] ?? 0) + durationMs)
        }
    }

    async measure<T>(key: TDurationKey, fn: () => Promise<T>): Promise<T> {
        const start = performance.now()
        try {
            return await fn()
        } finally {
            this.setDuration(key, performance.now() - start)
        }
    }

    async measureAndAdd<T>(key: TDurationKey, fn: () => Promise<T>): Promise<T> {
        const start = performance.now()
        try {
            return await fn()
        } finally {
            this.addDuration(key, performance.now() - start)
        }
    }

    measureSync<T>(key: TDurationKey, fn: () => T): T {
        const start = performance.now()
        try {
            return fn()
        } finally {
            this.setDuration(key, performance.now() - start)
        }
    }

    measureSyncAndAdd<T>(key: TDurationKey, fn: () => T): T {
        const start = performance.now()
        try {
            return fn()
        } finally {
            this.addDuration(key, performance.now() - start)
        }
    }

    protected elapsedSinceStartMs(): number {
        return performance.now() - this.startedAt
    }

    abstract capture(success: boolean, error?: unknown): void | Promise<void>
}

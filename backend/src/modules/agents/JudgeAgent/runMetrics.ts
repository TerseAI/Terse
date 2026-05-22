export function computeAverageRunDurationMs(runs: Array<{ timestamp: Date; updated_at: Date }>): number {
    if (runs.length === 0) {
        return 0
    }

    const totalDurationMs = runs.reduce((sum, run) => {
        const duration = run.updated_at.getTime() - run.timestamp.getTime()
        return sum + Math.max(0, duration)
    }, 0)

    return Math.round(totalDurationMs / runs.length)
}

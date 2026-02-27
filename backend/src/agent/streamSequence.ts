type RunStreamSequenceState = {
    nextValue: number
    lastTouchedAt: number
}

const runSequenceByRunId = new Map<string, RunStreamSequenceState>()
const STALE_RUN_MS = 1000 * 60 * 60 * 12

function cleanupStaleSequences(now: number): void {
    for (const [runId, state] of runSequenceByRunId) {
        if (now - state.lastTouchedAt > STALE_RUN_MS) {
            runSequenceByRunId.delete(runId)
        }
    }
}

export function nextRunStreamSequence(runId: string): number {
    const now = Date.now()
    cleanupStaleSequences(now)

    const existing = runSequenceByRunId.get(runId)
    if (!existing) {
        runSequenceByRunId.set(runId, {
            nextValue: 2,
            lastTouchedAt: now
        })
        return 1
    }

    const sequence = existing.nextValue
    existing.nextValue += 1
    existing.lastTouchedAt = now
    return sequence
}

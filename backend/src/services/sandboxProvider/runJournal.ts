// Compatibility storage for deployed durable runtimes that predate remote journals.
// Each suspension snapshots the sandbox, including this per-run directory.
export const JOURNAL_ROOT = "/terse-runs"

export function runJournalDir(runId: string): string {
    return `${JOURNAL_ROOT}/${runId}`
}

// Per-run journal directory inside the sandbox. When a run suspends, this directory
// is captured with a Modal directory snapshot and restored into the resuming sandbox,
// so the journal lives on the sandbox's own filesystem and only suspended runs snapshot.
export const JOURNAL_ROOT = "/terse-runs"

export function runJournalDir(runId: string): string {
    return `${JOURNAL_ROOT}/${runId}`
}

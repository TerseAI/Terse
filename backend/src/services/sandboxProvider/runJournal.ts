// Per-run journal directory inside the sandbox. A suspending run snapshots its whole
// filesystem, so the journal rides along with every other edit the run made and the
// resuming sandbox boots straight from that image.
export const JOURNAL_ROOT = "/terse-runs"

export function runJournalDir(runId: string): string {
    return `${JOURNAL_ROOT}/${runId}`
}

import type { JournalEvent } from "./journalEvent.js"

export type JournalSnapshot = {
    readonly revision: number
    readonly records: readonly JournalEvent[]
}

export interface JournalStore {
    read(runId: string): Promise<JournalSnapshot>
    append(runId: string, expectedRevision: number, event: JournalEvent): Promise<number>
}

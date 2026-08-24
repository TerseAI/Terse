import type { JournalEvent } from "./journalEvent.js"

export type JournalSnapshot = {
    readonly revision: number
    readonly records: readonly JournalEvent[]
}

export type ReadJournalParams = {
    readonly runId: string
}

export type AppendJournalEventParams = {
    readonly runId: string
    readonly expectedRevision: number
    readonly event: JournalEvent
}

export interface JournalStore {
    read(params: ReadJournalParams): Promise<JournalSnapshot>
    append(params: AppendJournalEventParams): Promise<number>
}

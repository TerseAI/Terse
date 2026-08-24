import type { JournalEvent } from "./journalEvent.js"

export type ReadJournalParams = {
    readonly runId: string
}

export type AppendJournalEventParams = {
    readonly runId: string
    readonly event: JournalEvent
}

export interface JournalStore {
    read(params: ReadJournalParams): Promise<readonly JournalEvent[]>
    append(params: AppendJournalEventParams): Promise<void>
}

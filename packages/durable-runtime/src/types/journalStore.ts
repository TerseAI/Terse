import type { JournalEvent } from "./journalEvent.js"

export type ListJournalEventsParams = {
    readonly runId: string
}

export type ListJournalEventsByTypeParams = {
    readonly runId: string
    readonly eventType: JournalEvent["type"]
}

export type GetJournalEventParams = {
    readonly runId: string
    readonly eventId: string
}

export type AppendJournalEventParams = {
    readonly runId: string
    readonly event: unknown
}

export interface JournalStore {
    list(params: ListJournalEventsParams): Promise<readonly JournalEvent[]>
    listByType(params: ListJournalEventsByTypeParams): Promise<readonly JournalEvent[]>
    get(params: GetJournalEventParams): Promise<JournalEvent | undefined>
    append(params: AppendJournalEventParams): Promise<JournalEvent>
}

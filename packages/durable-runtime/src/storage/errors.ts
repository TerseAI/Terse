export type JournalRevisionConflict = {
    readonly runId: string
    readonly expectedRevision: number
    readonly actualRevision: number
}

export class JournalRevisionConflictError extends Error {
    readonly runId: string
    readonly expectedRevision: number
    readonly actualRevision: number

    constructor(conflict: JournalRevisionConflict) {
        super(`Journal revision conflict for run "${conflict.runId}": expected ${conflict.expectedRevision}, found ${conflict.actualRevision}`)
        this.name = "JournalRevisionConflictError"
        this.runId = conflict.runId
        this.expectedRevision = conflict.expectedRevision
        this.actualRevision = conflict.actualRevision
    }
}

export type ActiveExecution = {
    controller: AbortController
    cancelRequested: boolean
}

export type CancelAckResponse = {
    accepted: boolean
    reason?: string
}

export const USER_CANCELLED_REASON = "Run cancelled by user"

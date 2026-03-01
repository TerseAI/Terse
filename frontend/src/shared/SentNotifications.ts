export enum SentNotificationEventType {
    RUN_NOTIFICATION = "run_notification",
    APPROVAL_REQUEST = "approval_request",
    RUN_FAILURE = "run_failure"
}

export enum SentNotificationStatus {
    SENT = "sent",
    FAILED = "failed"
}

export type SentNotification = {
    id: string
    eventType: SentNotificationEventType
    destinationType: "email" | "slack"
    destinationLabel: string
    status: SentNotificationStatus
    agentName?: string
    agentId?: string
    runId?: string
    sentAt: string
    errorMessage?: string
}

export type GetSentNotificationsResponse = {
    items: SentNotification[]
    page: number
    pageSize: number
    total: number
}

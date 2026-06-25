/**
 * Canonical BullMQ queue names. Shared by producers (backend) and the worker process so the two
 * sides never drift.
 */
export const QueueName = {
    /** Recurring user cron triggers (BullMQ Job Schedulers). */
    Schedule: "schedule",
    /** Platform maintenance crons (token refresh, secret cleanup, image cleanup, agent review). */
    Maintenance: "maintenance",
    /** Durable agent run execution. */
    SdkRunExecution: "sdk-run-execution"
} as const

export type QueueName = (typeof QueueName)[keyof typeof QueueName]

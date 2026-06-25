/**
 * Canonical BullMQ queue names. Shared by producers (backend) and the worker process so the two
 * sides never drift.
 */
export const QueueName = {
    /** Best-effort analytics on integration added (exactly-once work). */
    IntegrationEvents: "integration-events",
    /** Recurring user cron triggers (BullMQ Job Schedulers). */
    Schedule: "schedule",
    /** Platform maintenance crons (token refresh, secret cleanup, image cleanup). */
    Maintenance: "maintenance",
    /** Durable agent run execution (start jobs). */
    SdkRunExecution: "sdk-run-execution",
    /** Resume an agent run after an approval decision (suspend-and-resume). */
    SdkRunResume: "sdk-run-resume"
} as const

export type QueueName = (typeof QueueName)[keyof typeof QueueName]

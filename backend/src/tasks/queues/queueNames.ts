/**
 * Canonical pg-boss queue names. Shared by producers (backend) and the worker process so the two
 * sides never drift. The platform maintenance crons use derived per-job queue names — see
 * maintenanceQueue.ts.
 */
export const QueueName = {
    /** User cron trigger jobs (one pg-boss schedule per trigger, keyed by input id). */
    Schedule: "schedule",
    /** Durable agent run execution. */
    SdkRunExecution: "sdk-run-execution"
} as const

export type QueueName = (typeof QueueName)[keyof typeof QueueName]

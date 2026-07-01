/**
 * Canonical pg-boss queue names. Shared by producers (backend) and the worker process so the two
 * sides never drift. The platform maintenance crons use derived per-job queue names — see
 * maintenanceQueue.ts.
 */
export const QueueName = {
    /** User cron trigger fan-out target (one job per due trigger per minute). */
    Schedule: "schedule",
    /** Per-minute dispatcher that reads automation_time_trigger_configs and fans out Schedule jobs. */
    ScheduleDispatch: "schedule-dispatch",
    /** Durable agent run execution. */
    SdkRunExecution: "sdk-run-execution"
} as const

export type QueueName = (typeof QueueName)[keyof typeof QueueName]

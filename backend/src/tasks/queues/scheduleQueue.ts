/**
 * Producer for the `schedule` queue — recurring cron triggers via BullMQ Job Schedulers.
 *
 * Replaces GCP Cloud Scheduler. The job-scheduler id is deterministic (`terse-schedule-<inputId>`)
 * so it is reconstructable from Postgres (the durable source of truth) on worker boot. upsert is
 * idempotent, so reconciliation and re-deploys are safe.
 */
import { getQueue } from "../../loaders/bullmq"

import { QueueName } from "./queueNames"

export const SCHEDULE_JOB_NAME = "schedule"

export interface ScheduleJobData {
    inputId: string
}

export function scheduleJobId(inputId: string): string {
    return `terse-schedule-${inputId}`
}

/** Create or update the recurring scheduler for a time trigger. Throws if Redis is unavailable. */
export async function upsertScheduleTrigger(inputId: string, cronExpression: string): Promise<void> {
    await getQueue(QueueName.Schedule).upsertJobScheduler(scheduleJobId(inputId), { pattern: cronExpression, tz: "UTC" }, { name: SCHEDULE_JOB_NAME, data: { inputId } satisfies ScheduleJobData })
}

/** Remove the recurring scheduler for a time trigger. Throws if Redis is unavailable. */
export async function removeScheduleTrigger(inputId: string): Promise<void> {
    await getQueue(QueueName.Schedule).removeJobScheduler(scheduleJobId(inputId))
}

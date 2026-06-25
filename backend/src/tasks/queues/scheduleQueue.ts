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

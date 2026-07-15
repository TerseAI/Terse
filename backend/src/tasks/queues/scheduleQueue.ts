import { CronExpressionParser } from "cron-parser"
import { Timezone } from "terse-types/Timezones"

import logger from "../../common/logger"
import { Boss } from "../../loaders/pgBoss"

import { QueueName } from "./queueNames"

export async function upsertScheduleTrigger(inputId: string, cronExpression: string, timezone?: Timezone): Promise<void> {
    const tz = timezone ?? "UTC"
    assertValidUserCron(inputId, cronExpression, tz)
    await Boss.getInstance()
        .getBoss()
        .schedule(QueueName.Schedule, cronExpression, { inputId } satisfies ScheduleJobData, { tz, key: inputId })
    logger.info("Time trigger schedule upserted", { inputId, cronExpression, timezone: tz })
}

export async function removeScheduleTrigger(inputId: string): Promise<void> {
    await Boss.getInstance().getBoss().unschedule(QueueName.Schedule, inputId)
    logger.info("Time trigger schedule removed", { inputId })
}

export async function enqueueManualScheduleJob(inputId: string, manualContext?: string): Promise<void> {
    await Boss.getInstance()
        .getBoss()
        .send(QueueName.Schedule, { inputId, isManualTrigger: true, manualContext } satisfies ScheduleJobData)
}

export function assertValidUserCron(inputId: string, cronExpression: string, timezone: Timezone = "UTC"): void {
    if (cronExpression.trim().split(/\s+/).length !== 5) {
        throw new InvalidCronExpressionError(inputId, cronExpression)
    }
    try {
        CronExpressionParser.parse(cronExpression, { tz: timezone })
    } catch {
        throw new InvalidCronExpressionError(inputId, cronExpression)
    }
}

export class InvalidCronExpressionError extends Error {
    constructor(inputId: string, cronExpression: string) {
        super(`Invalid cron expression "${cronExpression}" for time trigger ${inputId} — expected a standard 5-field cron`)
        this.name = "InvalidCronExpressionError"
    }
}

export interface ScheduleJobData {
    inputId: string
    isManualTrigger?: boolean
    manualContext?: string
}

import { CronExpressionParser } from "cron-parser"

import logger from "../../common/logger"
import { Boss } from "../../loaders/pgBoss"

import { QueueName } from "./queueNames"

export async function upsertScheduleTrigger(inputId: string, cronExpression: string): Promise<void> {
    assertValidUserCron(inputId, cronExpression)
    await Boss.getInstance()
        .getBoss()
        .schedule(QueueName.Schedule, cronExpression, { inputId } satisfies ScheduleJobData, { tz: "UTC", key: inputId })
    logger.info("Time trigger schedule upserted", { inputId, cronExpression })
}

export async function removeScheduleTrigger(inputId: string): Promise<void> {
    await Boss.getInstance().getBoss().unschedule(QueueName.Schedule, inputId)
    logger.info("Time trigger schedule removed", { inputId })
}

/** Manual triggers always fire: no singleton dedupe. */
export async function enqueueManualScheduleJob(inputId: string, manualContext?: string): Promise<void> {
    await Boss.getInstance()
        .getBoss()
        .send(QueueName.Schedule, { inputId, isManualTrigger: true, manualContext } satisfies ScheduleJobData)
}

/**
 * This parse mirrors pg-boss's own validation (schedule() runs the identical cron-parser call),
 * but here it throws a typed error at the boundary without a DB write. The 5-field rule is
 * stricter than pg-boss: its scheduler fires at minute granularity, so a 6-field seconds cron
 * would pass validation and then silently degrade to once per minute.
 */
export function assertValidUserCron(inputId: string, cronExpression: string): void {
    if (cronExpression.trim().split(/\s+/).length !== 5) {
        throw new InvalidCronExpressionError(inputId, cronExpression)
    }
    try {
        CronExpressionParser.parse(cronExpression, { tz: "UTC" })
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

/**
 * User cron triggers. Postgres (automation_time_trigger_configs) is the single source of truth;
 * the worker's per-minute dispatcher (scheduleDispatcher.ts) reads it live and fans out `schedule`
 * jobs, so there is no per-trigger scheduler state to register or tear down anywhere else.
 */
import { CronExpressionParser } from "cron-parser"

import logger from "../../common/logger"

/** Validates the cron expression the dispatcher will evaluate. Throws InvalidCronExpressionError. */
export async function upsertScheduleTrigger(inputId: string, cronExpression: string): Promise<void> {
    try {
        CronExpressionParser.parse(cronExpression, { tz: "UTC" })
    } catch {
        throw new InvalidCronExpressionError(inputId, cronExpression)
    }
    logger.info("Time trigger schedule ready (dispatcher reads Postgres directly)", { inputId, cronExpression })
}

/** No scheduler state exists outside Postgres, so removal is complete once the row is gone. */
export async function removeScheduleTrigger(inputId: string): Promise<void> {
    logger.info("Time trigger schedule removed (dispatcher reads Postgres directly)", { inputId })
}

export class InvalidCronExpressionError extends Error {
    constructor(inputId: string, cronExpression: string) {
        super(`Invalid cron expression "${cronExpression}" for time trigger ${inputId}`)
        this.name = "InvalidCronExpressionError"
    }
}

export interface ScheduleJobData {
    inputId: string
}

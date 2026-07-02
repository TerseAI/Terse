/**
 * Per-minute dispatcher for user cron triggers. A single pg-boss schedule fires every minute; the
 * handler reads the active time-trigger configs from Postgres, evaluates which crons fire in that
 * minute (UTC), and fans out one `schedule` job per due trigger.
 *
 * Reading the table live each minute makes Postgres the only source of truth: there are no
 * per-trigger schedulers to reconcile on boot, and edits/deletes take effect on the next minute.
 * The minute-bucketed singletonKey (with singletonSeconds) means a duplicate dispatcher run can't
 * double-fire a trigger within the same minute.
 */
import { CronExpressionParser } from "cron-parser"

import logger from "../../common/logger"
import { Boss } from "../../loaders/pgBoss"
import { db } from "../../loaders/prisma"

import { QueueName } from "./queueNames"
import { enqueueDueScheduleJob } from "./scheduleQueue"

export async function registerScheduleDispatcher(): Promise<void> {
    await Boss.getInstance().getBoss().schedule(QueueName.ScheduleDispatch, "* * * * *", {}, { tz: "UTC" })
}

/** `scheduledFor` is the dispatch job's own scheduled time, so a late-running job still evaluates its own minute. */
export async function dispatchDueSchedules(scheduledFor: Date): Promise<void> {
    const minuteStart = truncateToMinute(scheduledFor)
    const configs = await db().automation_time_trigger_configs.findMany({
        where: { automation_input: { automation: { is_active: true } } },
        select: { automation_input_id: true, cron_expression: true }
    })

    let dispatched = 0
    let failed = 0
    for (const config of configs) {
        if (!config.cron_expression) continue
        if (!cronFiresAt(config.cron_expression, minuteStart, config.automation_input_id)) continue

        try {
            if (await enqueueDueScheduleJob(config.automation_input_id, minuteStart)) dispatched++
        } catch (error) {
            failed++
            logger.error("Failed to enqueue due time trigger", { inputId: config.automation_input_id, minute: minuteStart.toISOString(), error })
        }
    }

    if (dispatched > 0) {
        logger.info("Dispatched due time triggers", { minute: minuteStart.toISOString(), dispatched, totalConfigs: configs.length })
    }
    // Failing the job after attempting every trigger lets pg-boss retry the minute; the
    // singletonKey makes re-sending the already-dispatched triggers a no-op.
    if (failed > 0) {
        throw new ScheduleDispatchError(failed, minuteStart)
    }
}

function cronFiresAt(cronExpression: string, minuteStart: Date, inputId: string): boolean {
    try {
        const interval = CronExpressionParser.parse(cronExpression, {
            currentDate: new Date(minuteStart.getTime() - 1000),
            tz: "UTC"
        })
        return interval.next().toDate().getTime() === minuteStart.getTime()
    } catch (error) {
        logger.warn("Skipping time trigger with unparseable cron expression", { inputId, cronExpression, error })
        return false
    }
}

function truncateToMinute(date: Date): Date {
    const truncated = new Date(date)
    truncated.setUTCSeconds(0, 0)
    return truncated
}

export class ScheduleDispatchError extends Error {
    constructor(failedCount: number, minuteStart: Date) {
        super(`Failed to enqueue ${failedCount} due time trigger(s) for minute ${minuteStart.toISOString()}`)
        this.name = "ScheduleDispatchError"
    }
}

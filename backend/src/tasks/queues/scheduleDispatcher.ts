/**
 * Per-minute dispatcher for user cron triggers. A single pg-boss schedule fires every minute; the
 * handler reads all time-trigger configs from Postgres, evaluates which crons fire in that minute
 * (UTC), and fans out one `schedule` job per due trigger.
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
import { ScheduleJobData } from "./scheduleQueue"

export async function registerScheduleDispatcher(): Promise<void> {
    await Boss.getInstance().getBoss().schedule(QueueName.ScheduleDispatch, "* * * * *", {}, { tz: "UTC" })
}

/** `scheduledFor` is the dispatch job's own scheduled time, so a late-running job still evaluates its own minute. */
export async function dispatchDueSchedules(scheduledFor: Date): Promise<void> {
    const minuteStart = truncateToMinute(scheduledFor)
    const configs = await db().automation_time_trigger_configs.findMany({
        select: { automation_input_id: true, cron_expression: true }
    })

    let dispatched = 0
    for (const config of configs) {
        if (!config.cron_expression) continue
        if (!cronFiresAt(config.cron_expression, minuteStart, config.automation_input_id)) continue

        const jobId = await Boss.getInstance()
            .getBoss()
            .send(QueueName.Schedule, { inputId: config.automation_input_id } satisfies ScheduleJobData, {
                singletonKey: `${config.automation_input_id}:${minuteStart.toISOString()}`,
                singletonSeconds: 60
            })
        if (jobId) dispatched++
    }

    if (dispatched > 0) {
        logger.info("Dispatched due time triggers", { minute: minuteStart.toISOString(), dispatched, totalConfigs: configs.length })
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

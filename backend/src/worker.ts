/**
 * Terse background worker — a second entry point in the backend package that consumes BullMQ
 * queues (integration analytics now; crons + run execution in later phases). Reuses Prisma,
 * settings, and the domain handlers from the web process.
 *
 * Requires BULLMQ_REDIS_URL. Mirrors server.ts's graceful-shutdown lifecycle.
 */
import { Worker } from "bullmq"
import "dotenv/config"

import logger from "./common/logger"
import { CronJobIntegrationManager } from "./integrations/cronJob/integration"
import { handleIntegrationCompleted } from "./integrations/integrationEventHandler"
import { closeQueues, createWorkerConnection, isQueueRedisConfigured } from "./loaders/bullmq"
import { db } from "./loaders/prisma"
import { runClearOldSecretVersions, runTokenRefresh } from "./modules/maintenance/controller"
import { runCleanupSdkImages } from "./modules/sdk/maintenance/controller"
import { closeTaskQueuePubSub } from "./tasks/abstract/redisTaskQueue"
import { MaintenanceJob, upsertMaintenanceSchedulers } from "./tasks/queues/maintenanceQueue"
import { QueueName } from "./tasks/queues/queueNames"
import { ScheduleJobData, upsertScheduleTrigger } from "./tasks/queues/scheduleQueue"

const workers: Worker[] = []

function startWorker<T>(name: string, processor: (data: T) => Promise<void> | void, opts: { concurrency?: number } = {}): void {
    const worker = new Worker<T>(
        name,
        async job => {
            await processor(job.data)
        },
        { connection: createWorkerConnection(), concurrency: opts.concurrency ?? 10 }
    )
    worker.on("failed", (job, error) => logger.error(`[worker:${name}] job failed`, { jobId: job?.id, error }))
    worker.on("error", error => logger.error(`[worker:${name}] worker error`, { error }))
    workers.push(worker)
    logger.info(`[worker:${name}] started`)
}

function registerWorkers(): void {
    startWorker<Parameters<typeof handleIntegrationCompleted>[0]>(QueueName.IntegrationEvents, data => handleIntegrationCompleted(data))

    // Recurring cron triggers: a fired scheduler enqueues a `schedule` job; we process it by
    // invoking the same handler the old Cloud Scheduler webhook used. is_active is enforced inside.
    startWorker<ScheduleJobData>(QueueName.Schedule, async data => {
        await new CronJobIntegrationManager().processWebhookEvent({ inputId: data.inputId })
    })

    // Platform maintenance crons, discriminated by job name.
    startMaintenanceWorker()
    // Phase 5 registers SdkRunExecution + SdkRunResume.
}

/** Maintenance jobs share one queue and are dispatched by job name. */
async function runMaintenanceJob(name: string): Promise<void> {
    switch (name) {
        case MaintenanceJob.RefreshTokens:
            await runTokenRefresh()
            return
        case MaintenanceJob.ClearOldSecretVersions:
            await runClearOldSecretVersions({ dryRun: false })
            return
        case MaintenanceJob.CleanupSdkImages:
            await runCleanupSdkImages()
            return
        default:
            logger.warn(`[worker:${QueueName.Maintenance}] unknown maintenance job`, { name })
    }
}

function startMaintenanceWorker(): void {
    const worker = new Worker(
        QueueName.Maintenance,
        async job => {
            await runMaintenanceJob(job.name)
        },
        { connection: createWorkerConnection(), concurrency: 1 }
    )
    worker.on("failed", (job, error) => logger.error(`[worker:${QueueName.Maintenance}] job failed`, { job: job?.name, error }))
    worker.on("error", error => logger.error(`[worker:${QueueName.Maintenance}] worker error`, { error }))
    workers.push(worker)
    logger.info(`[worker:${QueueName.Maintenance}] started`)
}

/**
 * Rebuild the BullMQ Job Schedulers from Postgres (the durable source of truth) on every boot.
 * upsert is idempotent, so this self-heals a wiped/lost Redis and keeps schedulers in sync with the
 * automation_time_trigger_configs table.
 */
async function reconcileSchedules(): Promise<void> {
    const configs = await db().automation_time_trigger_configs.findMany({
        select: { automation_input_id: true, cron_expression: true }
    })

    let reconciled = 0
    for (const config of configs) {
        if (!config.cron_expression) continue
        try {
            await upsertScheduleTrigger(config.automation_input_id, config.cron_expression)
            reconciled++
        } catch (error) {
            logger.error("Failed to reconcile schedule from Postgres", { inputId: config.automation_input_id, error })
        }
    }
    logger.info("✅ Reconciled BullMQ schedules from Postgres", { reconciled, total: configs.length })
}

async function main(): Promise<void> {
    if (!isQueueRedisConfigured()) {
        logger.error("❌ BULLMQ_REDIS_URL is not set — the worker has nothing to connect to. Exiting.")
        process.exit(1)
    }

    logger.info("🛠  Terse worker starting")
    registerWorkers()
    await reconcileSchedules()
    await upsertMaintenanceSchedulers()
    logger.info("✅ Terse worker ready", { queues: workers.length })
}

await main()

let shuttingDown = false

async function gracefulShutdown(signal: string): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`🛑 ${signal} received — worker graceful shutdown`)

    const forceExit = setTimeout(() => {
        logger.error("⏰ Worker graceful shutdown timed out — forcing exit")
        process.exit(1)
    }, 30_000)
    forceExit.unref()

    try {
        // Stop accepting new jobs and let in-flight jobs finish.
        await Promise.allSettled(workers.map(worker => worker.close()))
        logger.info("✅ Workers drained")

        await closeQueues()
        await closeTaskQueuePubSub()
        logger.info("✅ Redis connections closed")

        try {
            await db().$disconnect()
            logger.info("✅ Prisma disconnected")
        } catch (error) {
            logger.error("Prisma disconnect failed", { error })
        }

        logger.info("👋 Worker graceful shutdown complete")
        clearTimeout(forceExit)
        process.exit(0)
    } catch (error) {
        logger.error("Worker graceful shutdown error", { error })
        clearTimeout(forceExit)
        process.exit(1)
    }
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => void gracefulShutdown("SIGINT"))

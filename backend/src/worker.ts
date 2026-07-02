/**
 * Terse background worker — a second entry point in the backend package that consumes the pg-boss
 * queues: user cron triggers, platform maintenance crons, and durable agent run execution. Reuses
 * Prisma, settings, and the domain handlers from the web process.
 *
 * Durable queue state lives in Postgres (pgboss schema); Redis is only used here for the
 * Socket.IO emit adapter and pub/sub. Mirrors server.ts's graceful-shutdown lifecycle.
 */
import "dotenv/config"
import { Job, JobWithMetadata } from "pg-boss"
import { RunHistoryStatus } from "terse-types"

import logger from "./common/logger"
import { CronJobIntegrationManager } from "./integrations/cronJob/integration"
import { Boss } from "./loaders/pgBoss"
import { db } from "./loaders/prisma"
import { WorkerSocketEmitter } from "./loaders/workerSocket"
import { markRunFailed } from "./modules/agents/AgentRunner/runHistory"
import { runReviewAllAgents } from "./modules/agents/review/controller"
import { runClearOldSecretVersions, runTokenRefresh } from "./modules/maintenance/controller"
import { runCleanupSdkImages } from "./modules/sdk/maintenance/controller"
import { registerSocketGetter } from "./services/CacheInvalidationService"
import { TaskQueueEmitter } from "./tasks/abstract/redisTaskQueue"
import { handleRunExecution } from "./tasks/handlers/runExecutionHandler"
import { MaintenanceJob, maintenanceQueueName, upsertMaintenanceSchedulers } from "./tasks/queues/maintenanceQueue"
import { QueueName } from "./tasks/queues/queueNames"
import { RunExecutionJobData, runExecutionJobId } from "./tasks/queues/runExecutionQueue"
import { dispatchDueSchedules, registerScheduleDispatcher } from "./tasks/queues/scheduleDispatcher"
import { ScheduleJobData } from "./tasks/queues/scheduleQueue"

const SDK_RUN_CONCURRENCY = Number(process.env.SDK_RUN_CONCURRENCY) || 25

async function main(): Promise<void> {
    // DATABASE_URL / REDIS_URL are hard requirements enforced in settings (requireEnv); importing
    // settings throws loudly before we get here if either is missing.
    logger.info("🛠  Terse worker starting")

    // Run execution streams via Socket.IO; wire the emit-only adapter and the getter the run/cache
    // services read through, before any run job can be picked up.
    await WorkerSocketEmitter.getInstance().init()
    registerSocketGetter(() => WorkerSocketEmitter.getInstance().getSocket())

    // Provision all queues + schedules before registering workers, so no worker polls a queue
    // that doesn't exist yet.
    await Boss.getInstance().start("worker")
    await upsertMaintenanceSchedulers()
    await registerScheduleDispatcher()
    await registerWorkers()
    await reconcileOrphanedRuns()
    logger.info("✅ Terse worker ready")
}

async function registerWorkers(): Promise<void> {
    const boss = Boss.getInstance().getBoss()

    // Cron triggers (fanned out by the dispatcher) and manual triggers (enqueued by the web role)
    // share this queue; we process both by invoking the same handler the old Cloud Scheduler
    // webhook used. is_active is enforced inside.
    await boss.work<ScheduleJobData>(
        QueueName.Schedule,
        { localConcurrency: 10 },
        withJobLogging(QueueName.Schedule, async data => {
            await new CronJobIntegrationManager().processWebhookEvent({
                inputId: data.inputId,
                isManualTrigger: data.isManualTrigger,
                manualContext: data.manualContext
            })
        })
    )

    // includeMetadata exposes startAfter: a late-running dispatch still evaluates its own scheduled
    // minute instead of the wall-clock one.
    await boss.work(QueueName.ScheduleDispatch, { localConcurrency: 1, includeMetadata: true }, async (jobs: JobWithMetadata[]) => {
        for (const job of jobs) {
            try {
                await dispatchDueSchedules(job.startAfter)
            } catch (error) {
                logger.error(`[worker:${QueueName.ScheduleDispatch}] dispatch failed`, { jobId: job.id, error })
                throw error
            }
        }
    })

    for (const job of Object.values(MaintenanceJob)) {
        const queue = maintenanceQueueName(job)
        await boss.work(queue, { localConcurrency: 1 }, withJobLogging(queue, MAINTENANCE_HANDLERS[job]))
    }

    await boss.work<RunExecutionJobData>(
        QueueName.SdkRunExecution,
        { localConcurrency: SDK_RUN_CONCURRENCY },
        withJobLogging(QueueName.SdkRunExecution, data => handleRunExecution(data))
    )
}

const MAINTENANCE_HANDLERS: Record<MaintenanceJob, () => Promise<void>> = {
    [MaintenanceJob.RefreshTokens]: async () => {
        await runTokenRefresh()
    },
    [MaintenanceJob.ClearOldSecretVersions]: async () => {
        await runClearOldSecretVersions({ dryRun: false })
    },
    [MaintenanceJob.CleanupSdkImages]: async () => {
        await runCleanupSdkImages()
    },
    [MaintenanceJob.ReviewAgents]: async () => {
        await runReviewAllAgents({ dryRun: false })
    },
    [MaintenanceJob.ReconcileOrphanedRuns]: async () => {
        await reconcileOrphanedRuns()
    }
}

/**
 * pg-boss delivers jobs in batches (size 1 by default); process each and log the outcome so per-job
 * visibility matches what the old queue event listeners provided. A throw marks the job failed
 * (these queues run retryLimit 0 — never re-delivered; schedule-dispatch retries, handled above).
 */
function withJobLogging<TData extends object>(queue: string, processor: (data: TData) => Promise<void> | void): (jobs: Job<TData>[]) => Promise<void> {
    return async jobs => {
        for (const job of jobs) {
            const startedAt = Date.now()
            try {
                await processor(job.data)
                logger.info(`[worker:${queue}] job completed`, { jobId: job.id, durationMs: Date.now() - startedAt })
            } catch (error) {
                logger.error(`[worker:${queue}] job failed`, { jobId: job.id, error })
                throw error
            }
        }
    }
}

/**
 * Fail runs left IN_PROGRESS with no live execution job — orphaned when a worker died mid-run or
 * the job hit its expiry ceiling (the Modal sandbox lifecycle is independent of the queue, so a
 * killed job can't be trusted to have finalized the run). Runs at boot and on a maintenance
 * schedule. Conservative: only stale runs whose job is not created/retry/active.
 */
async function reconcileOrphanedRuns(): Promise<void> {
    const STALE_MS = 15 * 60_000
    const cutoff = new Date(Date.now() - STALE_MS)

    const stale = await db().run_history_records.findMany({
        where: { status: RunHistoryStatus.IN_PROGRESS, updated_at: { lt: cutoff } },
        select: { id: true }
    })
    if (stale.length === 0) {
        logger.info("No orphaned runs to reconcile")
        return
    }

    const boss = Boss.getInstance().getBoss()
    const liveStates = new Set(["created", "retry", "active"])
    let failed = 0
    for (const run of stale) {
        const jobs = await boss.findJobs(QueueName.SdkRunExecution, { key: runExecutionJobId(run.id) })
        if (jobs.some(job => liveStates.has(job.state))) continue // legitimately executing
        try {
            if (await markRunFailed(run.id, "Run orphaned (no live execution job)", "agent")) failed++
        } catch (error) {
            logger.error("Failed to mark orphaned run as failed", { runId: run.id, error })
        }
    }
    logger.info("✅ Reconciled orphaned runs", { candidates: stale.length, failed })
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
        // Stops fetching new jobs, lets in-flight jobs finish, then closes the pool.
        await Boss.getInstance().stop()
        logger.info("✅ Queue workers drained")

        await TaskQueueEmitter.getInstance().close()
        await WorkerSocketEmitter.getInstance().close()
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

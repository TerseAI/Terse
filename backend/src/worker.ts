/**
 * Terse background worker — a second entry point in the backend package that consumes BullMQ
 * queues: integration analytics, user cron triggers, platform maintenance crons, and durable agent
 * run execution. Reuses Prisma, settings, and the domain handlers from the web process.
 *
 * Requires BULLMQ_REDIS_URL. Mirrors server.ts's graceful-shutdown lifecycle.
 */
import { Worker } from "bullmq"
import "dotenv/config"
import { RunHistoryStatus } from "terse-types"

import logger from "./common/logger"
import { CronJobIntegrationManager } from "./integrations/cronJob/integration"
import { handleIntegrationCompleted } from "./integrations/integrationEventHandler"
import { closeQueues, createWorkerConnection, getQueue } from "./loaders/bullmq"
import { db } from "./loaders/prisma"
import { closeWorkerSocketEmitter, getWorkerSocket, initWorkerSocketEmitter } from "./loaders/workerSocket"
import { markRunFailed } from "./modules/agents/AgentRunner/runHistory"
import { runReviewAllAgents } from "./modules/agents/review/controller"
import { runClearOldSecretVersions, runTokenRefresh } from "./modules/maintenance/controller"
import { runCleanupSdkImages } from "./modules/sdk/maintenance/controller"
import { registerSocketGetter } from "./services/CacheInvalidationService"
import { closeTaskQueuePubSub } from "./tasks/abstract/redisTaskQueue"
import { handleRunExecution } from "./tasks/handlers/runExecutionHandler"
import { MaintenanceJob, upsertMaintenanceSchedulers } from "./tasks/queues/maintenanceQueue"
import { QueueName } from "./tasks/queues/queueNames"
import { RunExecutionJobData, runExecutionJobId } from "./tasks/queues/runExecutionQueue"
import { ScheduleJobData, upsertScheduleTrigger } from "./tasks/queues/scheduleQueue"

const SDK_RUN_CONCURRENCY = Number(process.env.SDK_RUN_CONCURRENCY) || 25

const workers: Worker[] = []

function startWorker<T>(name: string, processor: (data: T) => Promise<void> | void, opts: { concurrency?: number; maxStalledCount?: number; lockDuration?: number } = {}): void {
    const worker = new Worker<T>(
        name,
        async job => {
            await processor(job.data)
        },
        {
            connection: createWorkerConnection(),
            concurrency: opts.concurrency ?? 10,
            ...(opts.maxStalledCount !== undefined ? { maxStalledCount: opts.maxStalledCount } : {}),
            ...(opts.lockDuration !== undefined ? { lockDuration: opts.lockDuration } : {})
        }
    )
    worker.on("failed", (job, error) => logger.error(`[worker:${name}] job failed`, { jobId: job?.id, error }))
    worker.on("error", error => logger.error(`[worker:${name}] worker error`, { error }))
    // A stalled job is one whose lock expired (worker died / event loop blocked past lockDuration).
    // With maxStalledCount:0 the run queue fails it instead of re-delivering — log so it's visible.
    worker.on("stalled", jobId => logger.warn(`[worker:${name}] job stalled (lock expired)`, { jobId }))
    worker.on("completed", job => {
        const startedAt = job.processedOn
        const finishedAt = job.finishedOn
        logger.info(`[worker:${name}] job completed`, { jobId: job.id, durationMs: startedAt && finishedAt ? finishedAt - startedAt : undefined })
    })
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

    // Durable agent run execution.
    //
    // The job stays ACTIVE for the whole run, including across a human tool-approval: the agent loop
    // runs server-side in handleSdkAgentRun (web), which holds the sandbox's SSE connection open
    // during waitForApprovalDecision, so the sandbox stays alive and this job's proc.wait() does not
    // return. BullMQ auto-renews the lock (every lockDuration/2) while this worker is alive, so a
    // multi-hour approval does not stall a healthy worker.
    //
    // Safety on worker death: lock expires -> stalled -> maxStalledCount:0 fails the job (never
    // re-delivered), and jobId run-<runId> dedupes any duplicate enqueue, so we never spawn a second
    // Modal sandbox or double-bill. The cost is that a worker DEPLOY/restart mid-run fails that run
    // (cleaned up by reconcileOrphanedRuns) rather than resuming it. True suspend-and-resume (so a
    // run survives a deploy mid-approval) requires changing the sandbox-side SDK/CLI run protocol and
    // is intentionally out of scope here — see the migration plan's Phase 5 notes.
    //
    // lockDuration is raised above the 30s default to give more headroom against transient event-loop
    // stalls before a healthy job is mistaken for a dead one.
    startWorker<RunExecutionJobData>(QueueName.SdkRunExecution, data => handleRunExecution(data), { concurrency: SDK_RUN_CONCURRENCY, maxStalledCount: 0, lockDuration: 60_000 })
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
        case MaintenanceJob.ReviewAgents:
            await runReviewAllAgents({ dryRun: false })
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

/**
 * Fail runs left IN_PROGRESS with no live execution job — orphaned when a worker died mid-run
 * (the Modal sandbox lifecycle is independent of BullMQ, so a re-delivered/killed job can't be
 * trusted to have finalized the run). Conservative: only stale runs with no active/queued job.
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

    const queue = getQueue(QueueName.SdkRunExecution)
    const liveStates = new Set(["active", "waiting", "delayed", "prioritized", "waiting-children"])
    let failed = 0
    for (const run of stale) {
        const job = await queue.getJob(runExecutionJobId(run.id))
        const state = job ? await job.getState() : null
        if (state && liveStates.has(state)) continue // legitimately executing
        try {
            if (await markRunFailed(run.id, "Run orphaned (no active execution job after worker restart)", "agent")) failed++
        } catch (error) {
            logger.error("Failed to mark orphaned run as failed", { runId: run.id, error })
        }
    }
    logger.info("✅ Reconciled orphaned runs", { candidates: stale.length, failed })
}

async function main(): Promise<void> {
    // BULLMQ_REDIS_URL is a hard requirement enforced in settings (requireEnv); importing settings
    // throws loudly before we get here if it is missing.
    logger.info("🛠  Terse worker starting")

    // Run execution streams via Socket.IO; wire the emit-only adapter and the getter the run/cache
    // services read through, before any run job can be picked up.
    await initWorkerSocketEmitter()
    registerSocketGetter(getWorkerSocket)

    registerWorkers()
    await reconcileSchedules()
    await upsertMaintenanceSchedulers()
    await reconcileOrphanedRuns()
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
        await closeWorkerSocketEmitter()
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

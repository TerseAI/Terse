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
import { handleIntegrationCompleted } from "./integrations/integrationEventHandler"
import { closeQueues, createWorkerConnection, isQueueRedisConfigured } from "./loaders/bullmq"
import { db } from "./loaders/prisma"
import { closeTaskQueuePubSub } from "./tasks/abstract/redisTaskQueue"
import { QueueName } from "./tasks/queues/queueNames"

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
    // Phase 3 registers the Schedule worker; Phase 5 registers SdkRunExecution + SdkRunResume.
}

async function main(): Promise<void> {
    if (!isQueueRedisConfigured()) {
        logger.error("❌ BULLMQ_REDIS_URL is not set — the worker has nothing to connect to. Exiting.")
        process.exit(1)
    }

    logger.info("🛠  Terse worker starting")
    registerWorkers()
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

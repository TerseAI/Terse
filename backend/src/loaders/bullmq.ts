/**
 * BullMQ / ioredis connection wiring.
 *
 * Two connection profiles per the BullMQ resilience guide:
 *  - Producer/enqueue: `maxRetriesPerRequest: 3` so a command fails fast (and throws) when Redis
 *    is unreachable. There is NO fallback — a failed enqueue is a failed operation. Callers must
 *    not run the work inline on the current service.
 *  - Worker: `maxRetriesPerRequest: null` so the worker blocks and resumes when Redis returns
 *    rather than throwing mid-processing.
 *
 * The backing Redis MUST be configured with `maxmemory-policy=noeviction`; under `allkeys-lru`
 * (or any eviction policy) BullMQ can silently lose queued jobs.
 */
import { Queue } from "bullmq"
import IORedis from "ioredis"

import logger from "../common/logger"
import { queue } from "../settings"

function attachConnectionLogging(connection: IORedis, label: string): IORedis {
    connection.on("error", error => {
        logger.error(`[${label}] Redis connection error`, { error })
    })
    connection.on("ready", () => {
        logger.info(`[${label}] Redis connection ready`)
    })
    connection.on("reconnecting", () => {
        logger.warn(`[${label}] Redis reconnecting`)
    })
    return connection
}

let producerConnection: IORedis | null = null

/**
 * Shared producer connection for enqueueing jobs. Fails fast (throws) when Redis is down.
 * Reused across all producer-side Queue instances.
 */
export function getProducerConnection(): IORedis {
    if (!producerConnection) {
        producerConnection = attachConnectionLogging(
            new IORedis(queue.redisUrl, {
                maxRetriesPerRequest: 3
            }),
            "bullmq-producer"
        )
    }
    return producerConnection
}

/**
 * A connection that retries forever (suitable for Workers and pub/sub) so it resumes after a
 * Redis blip rather than throwing. Each consumer should own its own connection.
 */
export function createQueueRedisConnection(label: string): IORedis {
    return attachConnectionLogging(
        new IORedis(queue.redisUrl, {
            maxRetriesPerRequest: null
        }),
        label
    )
}

/**
 * A dedicated connection for a Worker. BullMQ duplicates internally for blocking ops.
 */
export function createWorkerConnection(): IORedis {
    return createQueueRedisConnection("bullmq-worker")
}

const queues = new Map<string, Queue>()

/**
 * Memoized producer-side Queue handle (one per queue name), sharing the producer connection.
 */
export function getQueue(name: string): Queue {
    let queue = queues.get(name)
    if (!queue) {
        queue = new Queue(name, { connection: getProducerConnection() })
        queues.set(name, queue)
    }
    return queue
}

/**
 * Close all producer-side queues and the shared connection. Call on graceful shutdown.
 */
export async function closeQueues(): Promise<void> {
    await Promise.allSettled([...queues.values()].map(queue => queue.close()))
    queues.clear()
    if (producerConnection) {
        await producerConnection.quit().catch(() => {})
        producerConnection = null
    }
}

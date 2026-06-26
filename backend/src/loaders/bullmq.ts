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
import { redis } from "../settings"

import { RedisNamespace } from "./redisNamespace"

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

export class BullMq {
    private static instance: BullMq
    private producerConnection: IORedis | null = null
    private queues = new Map<string, Queue>()

    private constructor() {}

    public static getInstance(): BullMq {
        if (!BullMq.instance) {
            BullMq.instance = new BullMq()
        }
        return BullMq.instance
    }

    /**
     * Shared producer connection for enqueueing jobs. Fails fast (throws) when Redis is down.
     * Reused across all producer-side Queue instances.
     */
    public getProducerConnection(): IORedis {
        if (!this.producerConnection) {
            this.producerConnection = attachConnectionLogging(
                new IORedis(redis.url, {
                    maxRetriesPerRequest: 3
                }),
                "bullmq-producer"
            )
        }
        return this.producerConnection
    }

    /**
     * A connection that retries forever (suitable for Workers and pub/sub) so it resumes after a
     * Redis blip rather than throwing. Each consumer should own its own connection.
     */
    public createQueueRedisConnection(label: string): IORedis {
        return attachConnectionLogging(
            new IORedis(redis.url, {
                maxRetriesPerRequest: null
            }),
            label
        )
    }

    /**
     * A dedicated connection for a Worker. BullMQ duplicates internally for blocking ops.
     */
    public createWorkerConnection(): IORedis {
        return this.createQueueRedisConnection("bullmq-worker")
    }

    /**
     * Memoized producer-side Queue handle (one per queue name), sharing the producer connection.
     */
    public getQueue(name: string): Queue {
        let queue = this.queues.get(name)
        if (!queue) {
            queue = new Queue(name, { connection: this.getProducerConnection(), prefix: RedisNamespace.bullmq })
            this.queues.set(name, queue)
        }
        return queue
    }

    /**
     * Close all producer-side queues and the shared connection. Call on graceful shutdown.
     */
    public async close(): Promise<void> {
        await Promise.allSettled([...this.queues.values()].map(queue => queue.close()))
        this.queues.clear()
        if (this.producerConnection) {
            await this.producerConnection.quit().catch(() => {})
            this.producerConnection = null
        }
    }
}

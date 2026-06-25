/**
 * The TaskQueue implementation, backed by mqemitter-redis (Redis pub/sub).
 *
 * Signals (cancellation, streamed events, approval decisions) cross process boundaries, so the
 * instance holding an SSE stream / running a job receives a signal emitted on a different instance.
 *
 * mqemitter-redis gives us an emitter-style API (`emit`/`on`/`removeListener`) over Redis pub/sub
 * and handles subscription multiplexing, reconnection, and local-vs-redis echo de-duplication (via
 * its internal LRU cache) for us, so the originating instance receives its own events exactly once
 * and `waitFor` works on the same instance that emitted.
 *
 * A single shared emitter is multiplexed across every RedisTaskQueue instance (two Redis
 * connections total), keyed by topic `<namespace>/<taskName>`.
 *
 * The queue Redis (BULLMQ_REDIS_URL) is a hard dependency: the backend fails loud at boot if it is
 * unset (see settings). While Redis is down, emits are logged and subscribers receive nothing until
 * reconnect (mqemitter-redis reconnects under the hood); signals are not delivered during an outage.
 */
import MQEmitterRedis from "mqemitter-redis"

import logger from "../../common/logger"
import { queue } from "../../settings"

import { Task, TaskListener, TaskQueue, Unsubscribe, WaitForOptions } from "./tasks"

type MqMessage = Record<string, unknown> & { topic: string }
type MqListener = (message: MqMessage, done: () => void) => void

let sharedEmitter: ReturnType<typeof MQEmitterRedis> | null = null

function getEmitter(): ReturnType<typeof MQEmitterRedis> {
    if (!sharedEmitter) {
        sharedEmitter = MQEmitterRedis({ connectionString: queue.redisUrl })
    }
    return sharedEmitter
}

/** Close the shared emitter (both Redis connections). Call on graceful shutdown. */
export async function closeTaskQueuePubSub(): Promise<void> {
    if (!sharedEmitter) return
    const emitter = sharedEmitter
    sharedEmitter = null
    await new Promise<void>(resolve => emitter.close(() => resolve()))
}

export class RedisTaskQueue<T extends Task> implements TaskQueue<T> {
    private wrapped = new Map<TaskListener<T>, MqListener>()

    constructor(private readonly namespace: string) {}

    private topic(taskName: string): string {
        return `${this.namespace}/${taskName}`
    }

    emit(task: T): void {
        getEmitter().emit({ topic: this.topic(task.taskName), payload: task }, error => {
            if (error) {
                logger.error("RedisTaskQueue emit failed — signal dropped (Redis unavailable)", { error, taskName: task.taskName })
            }
        })
    }

    addListener(listener: TaskListener<T>): Unsubscribe {
        const mqListener: MqListener = (message, done) => {
            try {
                void listener.onTask(message.payload as T)
            } finally {
                done()
            }
        }
        this.wrapped.set(listener, mqListener)
        getEmitter().on(this.topic(listener.taskName), mqListener)
        return () => this.removeListener(listener)
    }

    removeListener(listener: TaskListener<T>): void {
        const mqListener = this.wrapped.get(listener)
        if (mqListener) {
            getEmitter().removeListener(this.topic(listener.taskName), mqListener)
            this.wrapped.delete(listener)
        }
    }

    waitFor(taskName: string, predicate: (task: T) => boolean, options?: WaitForOptions): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let timeout: NodeJS.Timeout | undefined

            const listener: TaskListener<T> = {
                taskName,
                onTask: (task: T) => {
                    if (!predicate(task)) return

                    if (timeout) clearTimeout(timeout)
                    this.removeListener(listener)
                    resolve(task)
                }
            }

            if (options?.timeoutMs) {
                timeout = setTimeout(() => {
                    this.removeListener(listener)
                    reject(new Error(`waitFor("${taskName}") timed out after ${options.timeoutMs}ms`))
                }, options.timeoutMs)
            }

            this.addListener(listener)
        })
    }
}

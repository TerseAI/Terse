import MQEmitterRedis from "mqemitter-redis"

import logger from "../../common/logger"
import { RedisNamespace } from "../../loaders/redisNamespace"
import { redis } from "../../settings"

import { Task, TaskListener, TaskQueue, Unsubscribe, WaitForOptions } from "./tasks"

type MqMessage = Record<string, unknown> & { topic: string }
type MqListener = (message: MqMessage, done: () => void) => void

let sharedEmitter: ReturnType<typeof MQEmitterRedis> | null = null

function getEmitter(): ReturnType<typeof MQEmitterRedis> {
    if (!sharedEmitter) {
        sharedEmitter = MQEmitterRedis({ connectionString: redis.url })
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
        return `${RedisNamespace.pubsub}/${this.namespace}/${taskName}`
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

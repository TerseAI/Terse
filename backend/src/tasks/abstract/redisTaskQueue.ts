import MQEmitterRedis from "mqemitter-redis"

import logger from "../../common/logger"
import { RedisNamespace } from "../../loaders/redisNamespace"
import { redis } from "../../settings"

import { Task, TaskListener, TaskQueue, Unsubscribe, WaitForOptions } from "./tasks"

type MqMessage = Record<string, unknown> & { topic: string }
type MqListener = (message: MqMessage, done: () => void) => void

export class TaskQueueEmitter {
    private static instance: TaskQueueEmitter
    private emitter: ReturnType<typeof MQEmitterRedis> | null = null

    private constructor() {}

    public static getInstance(): TaskQueueEmitter {
        if (!TaskQueueEmitter.instance) {
            TaskQueueEmitter.instance = new TaskQueueEmitter()
        }
        return TaskQueueEmitter.instance
    }

    public getEmitter(): ReturnType<typeof MQEmitterRedis> {
        if (!this.emitter) {
            const emitter = MQEmitterRedis({ connectionString: redis.url })
            emitter.state.on("error", (error: Error) => logger.error("RedisTaskQueue pub/sub connection error (Redis unavailable)", { error }))
            this.emitter = emitter
        }
        return this.emitter
    }

    /** Close the shared emitter (both Redis connections). Call on graceful shutdown. */
    public async close(): Promise<void> {
        if (!this.emitter) return
        const emitter = this.emitter
        this.emitter = null
        await new Promise<void>(resolve => emitter.close(() => resolve()))
    }
}

export class RedisTaskQueue<T extends Task> implements TaskQueue<T> {
    private wrapped = new Map<TaskListener<T>, MqListener>()

    constructor(private readonly namespace: string) {}

    private topic(taskName: string): string {
        return `${RedisNamespace.pubsub}/${this.namespace}/${taskName}`
    }

    emit(task: T): Promise<void> {
        return new Promise((resolve, reject) => {
            TaskQueueEmitter.getInstance()
                .getEmitter()
                .emit({ topic: this.topic(task.taskName), payload: task }, error => {
                    if (error) {
                        reject(new SignalPublishError(task.taskName, error))
                    } else {
                        resolve()
                    }
                })
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
        TaskQueueEmitter.getInstance().getEmitter().on(this.topic(listener.taskName), mqListener)
        return () => this.removeListener(listener)
    }

    removeListener(listener: TaskListener<T>): void {
        const mqListener = this.wrapped.get(listener)
        if (mqListener) {
            TaskQueueEmitter.getInstance().getEmitter().removeListener(this.topic(listener.taskName), mqListener)
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

export class SignalPublishError extends Error {
    constructor(taskName: string, cause: Error) {
        super(`Failed to publish "${taskName}" signal to Redis pub/sub: ${cause.message}`)
        this.name = "SignalPublishError"
    }
}

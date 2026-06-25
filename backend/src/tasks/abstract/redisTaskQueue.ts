/**
 * Redis pub/sub implementation of the {@link TaskQueue} interface.
 *
 * Unlike {@link EventEmitterTaskQueue}, signals (cancellation, approval decisions, streamed
 * events) cross process boundaries, so an instance handling an SSE/socket request receives a
 * signal emitted on a different instance.
 *
 * Delivery model: a single shared pair of connections (one publisher, one subscriber) is
 * multiplexed across every RedisTaskQueue instance, keyed by channel. Redis delivers a published
 * message to ALL subscribers of the channel — including this process's own subscriber connection —
 * so the originating instance receives its own events without any local echo, and `waitFor` works
 * on the same instance that emitted (subscribe-before-publish ordering provided by the call sites).
 *
 * There is NO in-process fallback: when Redis is configured it is a hard dependency. While Redis is
 * down, publishes are logged-and-dropped and subscribers receive nothing until reconnect (ioredis
 * auto-reconnects and we resubscribe). Cross-instance signals are simply not delivered during an
 * outage — by design.
 */
import IORedis from "ioredis"

import logger from "../../common/logger"
import { createQueueRedisConnection } from "../../loaders/bullmq"

import { Task, TaskListener, TaskQueue, Unsubscribe, WaitForOptions } from "./tasks"

type MessageHandler = (raw: string) => void

class RedisPubSubHub {
    private pub: IORedis | null = null
    private sub: IORedis | null = null
    private channelHandlers = new Map<string, Set<MessageHandler>>()

    private ensureConnections(): void {
        if (this.pub && this.sub) return

        this.pub = createQueueRedisConnection("taskqueue-pub")
        this.sub = createQueueRedisConnection("taskqueue-sub")

        this.sub.on("message", (channel: string, message: string) => {
            const handlers = this.channelHandlers.get(channel)
            if (!handlers) return
            for (const handler of [...handlers]) {
                try {
                    handler(message)
                } catch (error) {
                    logger.error("RedisTaskQueue handler threw", { error, channel })
                }
            }
        })

        // After a reconnect the server has dropped our subscriptions — re-establish them.
        this.sub.on("ready", () => {
            const channels = [...this.channelHandlers.keys()]
            if (channels.length === 0) return
            this.sub?.subscribe(...channels).catch(error => logger.error("RedisTaskQueue resubscribe failed", { error, channels: channels.length }))
        })
    }

    publish(channel: string, raw: string): void {
        this.ensureConnections()
        this.pub?.publish(channel, raw).catch(error => {
            logger.error("RedisTaskQueue publish failed — signal dropped (Redis unavailable)", { error, channel })
        })
    }

    subscribe(channel: string, handler: MessageHandler): Unsubscribe {
        this.ensureConnections()

        let handlers = this.channelHandlers.get(channel)
        if (!handlers) {
            handlers = new Set()
            this.channelHandlers.set(channel, handlers)
            this.sub?.subscribe(channel).catch(error => logger.error("RedisTaskQueue subscribe failed", { error, channel }))
        }
        handlers.add(handler)

        return () => {
            const set = this.channelHandlers.get(channel)
            if (!set) return
            set.delete(handler)
            if (set.size === 0) {
                this.channelHandlers.delete(channel)
                this.sub?.unsubscribe(channel).catch(() => {})
            }
        }
    }

    async close(): Promise<void> {
        await Promise.allSettled([this.pub?.quit(), this.sub?.quit()])
        this.pub = null
        this.sub = null
        this.channelHandlers.clear()
    }
}

const hub = new RedisPubSubHub()

/** Close the shared pub/sub connections. Call on graceful shutdown. */
export async function closeTaskQueuePubSub(): Promise<void> {
    await hub.close()
}

export class RedisTaskQueue<T extends Task> implements TaskQueue<T> {
    private unsubscribers = new Map<TaskListener<T>, Unsubscribe>()

    constructor(private readonly namespace: string) {}

    private channel(taskName: string): string {
        return `tq:${this.namespace}:${taskName}`
    }

    emit(task: T): void {
        hub.publish(this.channel(task.taskName), JSON.stringify(task))
    }

    addListener(listener: TaskListener<T>): Unsubscribe {
        const unsubscribe = hub.subscribe(this.channel(listener.taskName), raw => {
            let task: T
            try {
                task = JSON.parse(raw) as T
            } catch (error) {
                logger.error("RedisTaskQueue failed to parse task payload", { error, taskName: listener.taskName })
                return
            }
            void listener.onTask(task)
        })
        this.unsubscribers.set(listener, unsubscribe)
        return () => this.removeListener(listener)
    }

    removeListener(listener: TaskListener<T>): void {
        const unsubscribe = this.unsubscribers.get(listener)
        if (unsubscribe) {
            unsubscribe()
            this.unsubscribers.delete(listener)
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

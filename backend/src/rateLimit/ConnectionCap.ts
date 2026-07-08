import { type Redis } from "ioredis"
import { Semaphore } from "redis-semaphore"

import logger from "../common/logger"
import { RedisNamespace } from "../loaders/redisNamespace"

import { type ConnectionCapOptions } from "./RateLimiterClient"

export class ConnectionCap {
    constructor(
        private readonly redis: Redis,
        private readonly opts: ConnectionCapOptions
    ) {}

    public async tryAcquire(key: string): Promise<AcquiredSlot | null> {
        const semaphore = new Semaphore(this.redis, `${RedisNamespace.rateLimit}:conn:${this.opts.name}:${key}`, this.opts.max, {
            lockTimeout: this.opts.lockTimeoutMs,
            refreshInterval: this.opts.refreshIntervalMs,
            acquireAttemptsLimit: 1,
            onLockLost: error => logger.warn(`[connection-cap] ${this.opts.name} slot lost`, { error, key })
        })

        const acquired = await semaphore.tryAcquire()
        if (!acquired) return null

        return { release: () => semaphore.release() }
    }
}

export interface AcquiredSlot {
    release: () => Promise<void>
}

import crypto from "node:crypto"
import { type RedisClientType } from "redis"

import { type ConnectionCapOptions } from "./RateLimiterClient"

export interface AcquiredSlot {
    release: () => Promise<void>
    refresh: () => Promise<void>
}

export class ConnectionCap {
    private static readonly ACQUIRE_LUA = `
        local count = redis.call('SCARD', KEYS[1])
        if count >= tonumber(ARGV[1]) then return 0 end
        redis.call('SADD', KEYS[1], ARGV[2])
        redis.call('EXPIRE', KEYS[1], ARGV[3])
        return 1
    `

    private memoryStore: Map<string, Set<string>> | null = null

    constructor(
        private readonly redis: RedisClientType | null,
        private readonly opts: ConnectionCapOptions
    ) {
        if (!redis) this.memoryStore = new Map()
    }

    public async tryAcquire(key: string): Promise<AcquiredSlot | null> {
        const connId = crypto.randomUUID()
        const redisKey = `rl:conn:${this.opts.name}:${key}`

        const acquired = this.redis ? await this.acquireRedis(redisKey, connId) : this.acquireMemory(redisKey, connId)
        if (!acquired) return null

        return {
            release: () => this.release(redisKey, connId),
            refresh: () => this.refresh(redisKey)
        }
    }

    private async acquireRedis(redisKey: string, connId: string): Promise<boolean> {
        const result = (await this.redis!.eval(ConnectionCap.ACQUIRE_LUA, {
            keys: [redisKey],
            arguments: [String(this.opts.max), connId, String(this.opts.keyTtlSeconds)]
        })) as number
        return result === 1
    }

    private acquireMemory(redisKey: string, connId: string): boolean {
        const set = this.memoryStore!.get(redisKey) ?? new Set()
        if (set.size >= this.opts.max) return false
        set.add(connId)
        this.memoryStore!.set(redisKey, set)
        return true
    }

    private async release(redisKey: string, connId: string): Promise<void> {
        if (this.redis) {
            await this.redis.sRem(redisKey, connId)
        } else {
            const set = this.memoryStore!.get(redisKey)
            if (set) {
                set.delete(connId)
                if (set.size === 0) this.memoryStore!.delete(redisKey)
            }
        }
    }

    private async refresh(redisKey: string): Promise<void> {
        if (this.redis) await this.redis.expire(redisKey, this.opts.keyTtlSeconds)
        // No-op in memory mode: release() always fires from req.on("close").
    }
}

import crypto from "node:crypto"
import { type RedisClientType } from "redis"

import { RedisNamespace } from "../loaders/redisNamespace"

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

    constructor(
        private readonly redis: RedisClientType,
        private readonly opts: ConnectionCapOptions
    ) {}

    public async tryAcquire(key: string): Promise<AcquiredSlot | null> {
        const connId = crypto.randomUUID()
        const redisKey = `${RedisNamespace.rateLimit}:conn:${this.opts.name}:${key}`

        const result = (await this.redis.eval(ConnectionCap.ACQUIRE_LUA, {
            keys: [redisKey],
            arguments: [String(this.opts.max), connId, String(this.opts.keyTtlSeconds)]
        })) as number
        if (result !== 1) return null

        return {
            release: () => this.release(redisKey, connId),
            refresh: () => this.refresh(redisKey)
        }
    }

    private async release(redisKey: string, connId: string): Promise<void> {
        await this.redis.sRem(redisKey, connId)
    }

    private async refresh(redisKey: string): Promise<void> {
        await this.redis.expire(redisKey, this.opts.keyTtlSeconds)
    }
}

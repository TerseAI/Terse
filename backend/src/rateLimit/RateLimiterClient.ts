import { Request, RequestHandler, Response } from "express"
import { type RateLimiterAbstract, RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible"
import { type RedisClientType, createClient } from "redis"

import logger from "../common/logger"
import { settings } from "../settings"

import { ConnectionCap } from "./ConnectionCap"

export interface RateLimitOptions {
    name: string
    points: number
    duration: number
    keyBy: (req: Request) => string | null
    blockDuration?: number
    onLimit?: (req: Request, res: Response, info: { msBeforeNext: number }) => void
}

export interface ConnectionCapOptions {
    name: string
    max: number
    keyTtlSeconds: number
    heartbeatIntervalMs: number
}

export interface KeyLimitOptions {
    name: string
    points: number
    duration: number
    blockDuration?: number
}

export interface KeyLimiter {
    /**
     * Try to consume one point for the given key. Returns true if the call
     * is allowed, false if the limit has been hit. Re-raises non-limit errors
     * (e.g. Redis outages) so they aren't silently masked as a rate-limit.
     */
    tryConsume(key: string): Promise<boolean>
}

export class RateLimiterClient {
    private static instance: RateLimiterClient
    private redisClient: RedisClientType | null = null
    private initialized = false

    public static getInstance(): RateLimiterClient {
        if (!RateLimiterClient.instance) {
            RateLimiterClient.instance = new RateLimiterClient()
        }
        return RateLimiterClient.instance
    }

    private constructor() {}

    public async init(): Promise<void> {
        if (this.initialized) return
        const url = settings.optional.redisUrl?.trim()

        if (!url) {
            logger.info("ℹ️  REDIS_URL not set — rate limiter using in-memory store")
            this.initialized = true
            return
        }

        try {
            // Validate URL shape up front so a typo doesn't get swallowed
            // by node-redis's lazy connection errors.
            new URL(url)
            const client = createClient({ url }) as RedisClientType
            client.on("error", err => logger.error("Rate-limit Redis error", { err }))
            await client.connect()
            this.redisClient = client
            logger.info("✅ Rate-limit Redis connected")
        } catch (err) {
            logger.warn("⚠️  Rate-limit Redis connect failed — falling back to in-memory", { err })
        }

        this.initialized = true
    }

    public createLimiter(opts: RateLimitOptions): RequestHandler {
        this.assertInitialized()
        const limiter = this.buildLimiter(opts)
        return async (req, res, next) => {
            const key = opts.keyBy(req)
            if (key === null) return next()

            try {
                await limiter.consume(key)
                return next()
            } catch (rejection) {
                // rate-limiter-flexible throws either a RateLimiterRes (rejected)
                // or an actual error (Redis down, etc). Re-raise real errors;
                // they shouldn't masquerade as 429s.
                if (!(rejection instanceof RateLimiterRes)) {
                    logger.error(`[rate-limit] ${opts.name} internal error`, { err: rejection })
                    return next(rejection as Error)
                }
                const retryAfterSec = Math.max(1, Math.ceil(rejection.msBeforeNext / 1000))
                res.setHeader("Retry-After", String(retryAfterSec))
                if (opts.onLimit) return opts.onLimit(req, res, { msBeforeNext: rejection.msBeforeNext })
                res.status(429).json({ error: "Too many requests", retryAfterSeconds: retryAfterSec })
            }
        }
    }

    public createConnectionCap(opts: ConnectionCapOptions): ConnectionCap {
        this.assertInitialized()
        return new ConnectionCap(this.redisClient, opts)
    }

    /**
     * Non-HTTP key-based limiter. Use when you need rate limiting outside an
     * Express handler — e.g. throttling outbound replies to Slack DMs.
     */
    public createKeyLimiter(opts: KeyLimitOptions): KeyLimiter {
        this.assertInitialized()
        // buildLimiter only reads points/duration/blockDuration/name, but its
        // signature still requires keyBy — caller supplies its own key.
        const limiter = this.buildLimiter({ ...opts, keyBy: () => null })
        return {
            async tryConsume(key: string): Promise<boolean> {
                try {
                    await limiter.consume(key)
                    return true
                } catch (rejection) {
                    if (rejection instanceof RateLimiterRes) {
                        return false
                    }
                    throw rejection
                }
            }
        }
    }

    private buildLimiter(opts: RateLimitOptions): RateLimiterAbstract {
        const base = {
            points: opts.points,
            duration: opts.duration,
            blockDuration: opts.blockDuration,
            keyPrefix: `rl:${opts.name}`
        }
        return this.redisClient ? new RateLimiterRedis({ ...base, storeClient: this.redisClient, useRedisPackage: true }) : new RateLimiterMemory(base)
    }

    private assertInitialized(): void {
        if (!this.initialized) {
            throw new Error("RateLimiterClient.init() must be awaited before use")
        }
    }
}

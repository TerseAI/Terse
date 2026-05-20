import { Request, RequestHandler, Response } from "express"
import { type RateLimiterAbstract, RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible"
import { type RedisClientType, createClient } from "redis"

import { settings } from "../config/settings"
import logger from "../logger"

import { ConnectionCap } from "./ConnectionCap"

export interface RateLimitOptions {
    /** Logging tag + Redis key prefix. Must be unique per limiter. */
    name: string
    /** Requests allowed per window. */
    points: number
    /** Window in seconds. */
    duration: number
    /** Returns the bucket key, or `null` to skip rate limiting for this request. */
    keyBy: (req: Request) => string | null
    /** Optional extra block after exhaustion (seconds). */
    blockDuration?: number
    /** Override the default 429 response. */
    onLimit?: (req: Request, res: Response, info: { msBeforeNext: number }) => void
}

export interface ConnectionCapOptions {
    name: string
    max: number
    /** TTL on the Redis set holding open connection ids. Heartbeats refresh it. */
    keyTtlSeconds: number
    /** Heartbeat interval used by the SSE handler (re: `keyTtlSeconds`). */
    heartbeatIntervalMs: number
}

/**
 * Singleton that owns the Redis client and constructs rate limiters.
 * Mirrors the SecretService/SecretManagerClient pattern: private constructor,
 * static getInstance(), all state on the instance.
 *
 * Call `init()` once at server startup before any route is registered. The
 * limiters fall back to in-memory state when REDIS_URL is unset in dev/test;
 * production requires a working Redis connection so multi-instance deploys
 * share counters (otherwise an N-instance fleet effectively multiplies every
 * configured limit by N).
 */
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
            if (settings.nodeEnv === "production") {
                throw new Error("REDIS_URL is required in production for rate limiting")
            }
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
            if (settings.nodeEnv === "production") {
                logger.error("Rate-limit Redis connect failed in production", { err })
                throw err
            }
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

    private buildLimiter(opts: RateLimitOptions): RateLimiterAbstract {
        const base = {
            points: opts.points,
            duration: opts.duration,
            blockDuration: opts.blockDuration,
            keyPrefix: `rl:${opts.name}`
        }
        return this.redisClient ? new RateLimiterRedis({ ...base, storeClient: this.redisClient }) : new RateLimiterMemory(base)
    }

    private assertInitialized(): void {
        if (!this.initialized) {
            throw new Error("RateLimiterClient.init() must be awaited before use")
        }
    }
}

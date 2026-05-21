import crypto from "node:crypto"

import { settings } from "../../config/settings"
import logger from "../../logger"
import { RateLimiterClient } from "../../rateLimit/RateLimiterClient"

const TOKEN_PREFIX = "terse_jobk_"
const REDIS_DENYLIST_KEY = (jobId: string) => `anth-proxy:revoked:${jobId}`
const REDIS_KEY_BINDING = (jobId: string) => `anth-proxy:bind:${jobId}`

interface MintOpts {
    jobId: string
    ttlSeconds: number
    ephemeralApiKey: string
}

interface TokenPayload {
    jobId: string
    expiresAt: number
}

export class AnthropicProxyTokenService {
    private readonly hmacSecret: string
    private readonly inMemoryDenylist = new Map<string, number>()
    private readonly inMemoryBinding = new Map<string, { apiKey: string; expiresAt: number }>()

    constructor() {
        this.hmacSecret = settings.terseAnthropicProxy.hmacSecret
    }

    async mintToken(opts: MintOpts): Promise<string> {
        const expiresAt = Math.floor(Date.now() / 1000) + opts.ttlSeconds
        const payload: TokenPayload = { jobId: opts.jobId, expiresAt }
        const payloadJson = JSON.stringify(payload)
        const payloadB64 = base64url(Buffer.from(payloadJson, "utf8"))
        const signature = this.sign(payloadB64)
        const token = `${TOKEN_PREFIX}${payloadB64}.${signature}`

        await this.bindEphemeralKey(opts.jobId, opts.ephemeralApiKey, opts.ttlSeconds)
        return token
    }

    /**
     * Verifies a token's signature, expiry, and revocation status. Returns
     * the bound ephemeral Anthropic API key when valid; null otherwise.
     * Used by the proxy service — not by backend application code.
     */
    async verifyAndResolve(token: string): Promise<{ jobId: string; apiKey: string } | null> {
        const payload = this.verifySignature(token)
        if (!payload) return null
        if (payload.expiresAt < Math.floor(Date.now() / 1000)) return null
        if (await this.isRevoked(payload.jobId)) return null

        const apiKey = await this.lookupEphemeralKey(payload.jobId)
        if (!apiKey) return null
        return { jobId: payload.jobId, apiKey }
    }

    async revokeJobToken(jobId: string): Promise<void> {
        const redis = RateLimiterClient.getInstance().getRedis()
        const ttlSec = 24 * 60 * 60 // outlive any possible token TTL
        if (redis) {
            try {
                await redis.set(REDIS_DENYLIST_KEY(jobId), "1", { EX: ttlSec })
                await redis.del(REDIS_KEY_BINDING(jobId))
            } catch (error) {
                logger.warn("[AnthropicProxyToken] Redis revoke failed, falling back to memory", { jobId, error: errorMessage(error) })
                this.memoryRevoke(jobId, ttlSec)
            }
            return
        }
        this.memoryRevoke(jobId, ttlSec)
    }

    private async bindEphemeralKey(jobId: string, apiKey: string, ttlSeconds: number): Promise<void> {
        const redis = RateLimiterClient.getInstance().getRedis()
        if (redis) {
            try {
                await redis.set(REDIS_KEY_BINDING(jobId), apiKey, { EX: ttlSeconds })
                return
            } catch (error) {
                logger.warn("[AnthropicProxyToken] Redis bind failed, falling back to memory", { jobId, error: errorMessage(error) })
            }
        }
        this.inMemoryBinding.set(jobId, { apiKey, expiresAt: Date.now() + ttlSeconds * 1000 })
        this.gcMemory()
    }

    private async lookupEphemeralKey(jobId: string): Promise<string | null> {
        const redis = RateLimiterClient.getInstance().getRedis()
        if (redis) {
            try {
                return (await redis.get(REDIS_KEY_BINDING(jobId))) ?? null
            } catch (error) {
                logger.warn("[AnthropicProxyToken] Redis lookup failed, falling back to memory", { jobId, error: errorMessage(error) })
            }
        }
        const entry = this.inMemoryBinding.get(jobId)
        if (!entry) return null
        if (entry.expiresAt < Date.now()) {
            this.inMemoryBinding.delete(jobId)
            return null
        }
        return entry.apiKey
    }

    private async isRevoked(jobId: string): Promise<boolean> {
        const redis = RateLimiterClient.getInstance().getRedis()
        if (redis) {
            try {
                const v = await redis.get(REDIS_DENYLIST_KEY(jobId))
                return v !== null
            } catch (error) {
                logger.warn("[AnthropicProxyToken] Redis denylist check failed, falling back to memory", { jobId, error: errorMessage(error) })
            }
        }
        const exp = this.inMemoryDenylist.get(jobId)
        if (!exp) return false
        if (exp < Date.now()) {
            this.inMemoryDenylist.delete(jobId)
            return false
        }
        return true
    }

    private memoryRevoke(jobId: string, ttlSec: number): void {
        this.inMemoryDenylist.set(jobId, Date.now() + ttlSec * 1000)
        this.inMemoryBinding.delete(jobId)
        this.gcMemory()
    }

    private gcMemory(): void {
        const now = Date.now()
        for (const [k, v] of this.inMemoryDenylist) {
            if (v < now) this.inMemoryDenylist.delete(k)
        }
        for (const [k, v] of this.inMemoryBinding) {
            if (v.expiresAt < now) this.inMemoryBinding.delete(k)
        }
    }

    private sign(payloadB64: string): string {
        const mac = crypto.createHmac("sha256", this.hmacSecret).update(payloadB64).digest()
        return base64url(mac)
    }

    private verifySignature(token: string): TokenPayload | null {
        if (!token.startsWith(TOKEN_PREFIX)) return null
        const body = token.slice(TOKEN_PREFIX.length)
        const dotIdx = body.indexOf(".")
        if (dotIdx <= 0) return null

        const payloadB64 = body.slice(0, dotIdx)
        const sig = body.slice(dotIdx + 1)
        const expected = this.sign(payloadB64)

        const sigBuf = Buffer.from(sig)
        const expectedBuf = Buffer.from(expected)
        if (sigBuf.length !== expectedBuf.length) return null
        if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null

        try {
            const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as TokenPayload
            if (typeof payload.jobId !== "string" || typeof payload.expiresAt !== "number") return null
            return payload
        } catch {
            return null
        }
    }
}

function base64url(buf: Buffer): string {
    return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))
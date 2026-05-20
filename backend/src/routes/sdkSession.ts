import { Request, Response } from "express"
import crypto from "node:crypto"
import { User } from "terse-types/types"

import { onSessionEvent } from "../agent/SessionEventBus"
import logger from "../logger"
import { RateLimiterClient } from "../rateLimit/RateLimiterClient"
import { CONNECTION_CAPS } from "../rateLimit/presets"

// Lazy so the module load order doesn't matter — server.ts awaits
// RateLimiterClient.init() before any route fires, so the first hit here
// will see a fully-initialized client.
let cap: ReturnType<typeof RateLimiterClient.prototype.createConnectionCap> | null = null
function getSseCap() {
    if (!cap) cap = RateLimiterClient.getInstance().createConnectionCap(CONNECTION_CAPS.SSE_SESSION)
    return cap
}

export async function handleSessionEvents(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const slot = await getSseCap().tryAcquire(user.id)
    if (!slot) {
        res.setHeader("Retry-After", "30")
        return res.status(429).json({ error: "Too many concurrent SSE connections" })
    }

    const sessionId = crypto.randomUUID()

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    let cleanedUp = false
    const cleanup = () => {
        if (cleanedUp) return
        cleanedUp = true
        clearInterval(heartbeat)
        unsubscribe()
        void slot.release().catch(error => logger.warn("[sdkSession] slot.release failed", { error, sessionId, userId: user.id }))
        try {
            res.end()
        } catch {
            // already torn down by the underlying socket; nothing to do
        }
    }

    // Heartbeat refreshes the Redis TTL on the connection-cap set so a
    // crashed process can't leak slots forever, and the try/catch on write
    // is how we detect a half-open socket on which Node otherwise wouldn't
    // surface a close event.
    const heartbeat = setInterval(() => {
        try {
            res.write(`: ping\n\n`)
            void slot.refresh().catch(error => logger.warn("[sdkSession] slot.refresh failed", { error, sessionId, userId: user.id }))
        } catch {
            cleanup()
        }
    }, CONNECTION_CAPS.SSE_SESSION.heartbeatIntervalMs)

    const unsubscribe = onSessionEvent(sessionId, event => {
        try {
            res.write(`data: ${JSON.stringify(event)}\n\n`)
        } catch {
            cleanup()
        }
    })

    req.on("close", cleanup)
    req.on("error", cleanup)
    req.on("aborted", cleanup)

    try {
        res.write(`data: ${JSON.stringify({ type: "session_started", sessionId })}\n\n`)
    } catch {
        cleanup()
    }
}

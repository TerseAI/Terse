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

    let closed = false
    const safeWrite = (line: string): boolean => {
        if (closed) return false
        try {
            return res.write(line)
        } catch (error) {
            logger.warn("[sdkSession] write failed; closing SSE stream", { error, sessionId, userId: user.id })
            teardown()
            return false
        }
    }

    // Heartbeat refreshes the Redis TTL on the connection-cap set so a
    // crashed process can't leak slots forever. SSE comment lines start
    // with `:` and are ignored by the parser — used here as a keep-alive
    // that proxies don't strip and that surfaces half-open sockets.
    const heartbeat = setInterval(() => {
        safeWrite(`: keepalive\n\n`)
        void slot.refresh().catch(error => logger.warn("[sdkSession] slot.refresh failed", { error, sessionId, userId: user.id }))
    }, CONNECTION_CAPS.SSE_SESSION.heartbeatIntervalMs)

    const unsubscribe = onSessionEvent(sessionId, event => {
        safeWrite(`data: ${JSON.stringify(event)}\n\n`)
    })

    const teardown = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        void slot.release().catch(error => logger.warn("[sdkSession] slot.release failed", { error, sessionId, userId: user.id }))
        try {
            res.end()
        } catch {
            // already torn down by the underlying socket; nothing to do
        }
    }

    req.on("close", teardown)
    req.on("error", teardown)
    req.on("aborted", teardown)
    res.on("error", teardown)

    safeWrite(`data: ${JSON.stringify({ type: "session_started", sessionId })}\n\n`)
}

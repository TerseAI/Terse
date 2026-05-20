import { Request, Response } from "express"
import crypto from "node:crypto"
import { User } from "terse-types/types"

import { onSessionEvent } from "../agent/SessionEventBus"
import logger from "../logger"

// 15s heartbeat so the proxy/load balancer doesn't kill an idle SSE socket,
// and so we discover a half-open connection within a window of seconds
// rather than waiting for the next event to fail.
const SSE_HEARTBEAT_MS = 15_000

export function handleSessionEvents(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
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

    const heartbeat = setInterval(() => {
        // SSE comment lines start with `:` and are ignored by the parser; used
        // here as a keep-alive that proxies don't strip.
        safeWrite(`: keepalive\n\n`)
    }, SSE_HEARTBEAT_MS)

    const unsubscribe = onSessionEvent(sessionId, event => {
        safeWrite(`data: ${JSON.stringify(event)}\n\n`)
    })

    const teardown = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
    }

    req.on("close", teardown)
    req.on("error", teardown)
    res.on("error", teardown)

    safeWrite(`data: ${JSON.stringify({ type: "session_started", sessionId })}\n\n`)
}

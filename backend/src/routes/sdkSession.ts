import { Request, Response } from "express"
import crypto from "node:crypto"

import { onSessionEvent } from "../agent/SessionEventBus"
import { User } from "../shared/types"

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

    res.write(`data: ${JSON.stringify({ type: "session_started", sessionId })}\n\n`)

    const unsubscribe = onSessionEvent(sessionId, event => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
    })

    req.on("close", () => {
        unsubscribe()
    })
}

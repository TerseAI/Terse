import { Request, Response } from "express"
import crypto from "node:crypto"
import { SdkListenStreamEvent, User } from "terse-types"

import { onListenForwardedEvent } from "../agent/ListenBus"
import logger from "../logger"
import { db } from "../prismaClient"

const HEARTBEAT_INTERVAL_MS = 25_000

export async function handleSdkListen(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const jobName = typeof req.query.jobName === "string" ? req.query.jobName.trim() : ""
    if (!jobName) {
        return res.status(400).json({ error: "jobName query param is required" })
    }

    const automation = await db().automations.findFirst({
        where: { organization_id: user.organizationId, source: "SDK", name: jobName },
        select: { id: true }
    })
    if (!automation) {
        return res.status(404).json({ error: `Job "${jobName}" is not deployed in this org.` })
    }

    const listenerId = crypto.randomUUID()
    const organizationId = user.organizationId

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.flushHeaders()

    const send = (event: SdkListenStreamEvent): void => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    send({ type: "listen_started", listenerId, organizationId, jobName })

    const unsubscribe = onListenForwardedEvent(organizationId, forwarded => {
        if (forwarded.agentName !== jobName) return
        try {
            send(forwarded)
        } catch (error) {
            logger.warn("Failed to write to /sdk/listen SSE stream", { error, listenerId })
        }
    })

    // Plain SSE comment lines keep proxies/load balancers from closing the
    // idle connection. The SSE parser ignores them, so no schema entry needed.
    const heartbeat = setInterval(() => {
        try {
            res.write(`:\n\n`)
        } catch {
            // Connection is gone; cleanup runs in the close handler below.
        }
    }, HEARTBEAT_INTERVAL_MS)

    req.on("close", () => {
        clearInterval(heartbeat)
        unsubscribe()
    })
}

import { Request, Response } from "express"
import crypto from "node:crypto"
import { SdkListenStreamEvent, User, sdkListenQuerySchema } from "terse-types"

import { onListenForwardedEvent } from "../agent/ListenBus"
import logger from "../logger"
import { db } from "../prismaClient"

const HEARTBEAT_INTERVAL_MS = 25_000

export async function handleSdkListen(req: Request, res: Response) {
    const user = req.session?.user as User | undefined
    if (!user) {
        return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const parsed = sdkListenQuerySchema.safeParse(req.query)
    if (!parsed.success) {
        return res.status(400).json({ error: "jobName and projectId query params are required" })
    }
    const { jobName, projectId } = parsed.data

    const automation = await db().automations.findFirst({
        where: { organization_id: user.organizationId, project_id: projectId, name: jobName },
        select: { id: true }
    })
    if (!automation) {
        return res.status(404).json({ error: `Job "${jobName}" is not deployed in this project.` })
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

    send({ type: "listen_started", listenerId, organizationId, projectId, jobName })

    const unsubscribe = onListenForwardedEvent(organizationId, forwarded => {
        if (forwarded.agentName !== jobName) return
        if (forwarded.projectId !== projectId) return
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

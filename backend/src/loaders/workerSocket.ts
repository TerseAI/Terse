/**
 * Emit-only Socket.IO for the worker process.
 *
 * Run execution streams output and cache-invalidation events via Socket.IO. On the worker there is
 * no HTTP server and no connected clients, so we create a standalone Socket.IO Server wired to the
 * SAME Redis adapter as the web process (REDIS_URL — the cache/socket Redis, NOT the BullMQ Redis).
 * Emits then propagate through the adapter to clients connected on the web instances.
 *
 * If REDIS_URL is absent the server has no adapter and cross-process emits go nowhere; execution
 * still runs, but live streaming/cache invalidation won't reach browsers in a multi-process setup.
 */
import { createAdapter } from "@socket.io/redis-adapter"
import { createClient } from "redis"
import { Server } from "socket.io"

import logger from "../common/logger"
import { optional } from "../settings"

let io: Server | null = null
let pub: ReturnType<typeof createClient> | null = null
let sub: ReturnType<typeof createClient> | null = null

export async function initWorkerSocketEmitter(): Promise<void> {
    io = new Server() // standalone, emit-only (no httpServer.listen)

    const redisUrl = optional.redisUrl?.trim()
    if (!redisUrl) {
        logger.warn("⚠️  REDIS_URL not set — worker Socket.IO has no adapter; run streaming/cache invalidation will not reach web clients")
        return
    }

    try {
        new URL(redisUrl)
        pub = createClient({ url: redisUrl })
        sub = pub.duplicate()
        await pub.connect()
        await sub.connect()
        io.adapter(createAdapter(pub, sub))
        logger.info("✅ Worker Socket.IO Redis adapter connected (emit-only)")
    } catch (error) {
        logger.warn("⚠️  Worker Socket.IO: invalid/unavailable REDIS_URL; cross-process emits will not reach clients", { error })
    }
}

export function getWorkerSocket(): Server | null {
    return io
}

export async function closeWorkerSocketEmitter(): Promise<void> {
    if (io) io.close()
    await Promise.allSettled([pub?.quit(), sub?.quit()])
    io = null
    pub = null
    sub = null
}

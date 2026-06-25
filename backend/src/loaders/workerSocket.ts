import { createAdapter } from "@socket.io/redis-adapter"
import { createClient } from "redis"
import { Server } from "socket.io"

import logger from "../common/logger"
import { redis } from "../settings"

let io: Server | null = null
let pub: ReturnType<typeof createClient> | null = null
let sub: ReturnType<typeof createClient> | null = null

export async function initWorkerSocketEmitter(): Promise<void> {
    io = new Server() // standalone, emit-only (no httpServer.listen)

    // Same Redis adapter as the web process so worker-side emits (run streaming, cache invalidation)
    // reach browser clients connected on the web instances. Redis is required; failure is fatal.
    pub = createClient({ url: redis.url })
    sub = pub.duplicate()
    await pub.connect()
    await sub.connect()
    io.adapter(createAdapter(pub, sub))
    logger.info("✅ Worker Socket.IO Redis adapter connected (emit-only)")
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

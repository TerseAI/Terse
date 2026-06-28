import { createAdapter } from "@socket.io/redis-adapter"
import { createClient } from "redis"
import { Server } from "socket.io"

import logger from "../common/logger"
import { redis } from "../settings"

import { RedisNamespace } from "./redisNamespace"

export class WorkerSocketEmitter {
    private static instance: WorkerSocketEmitter
    private io: Server | null = null
    private pub: ReturnType<typeof createClient> | null = null
    private sub: ReturnType<typeof createClient> | null = null

    private constructor() {}

    public static getInstance(): WorkerSocketEmitter {
        if (!WorkerSocketEmitter.instance) {
            WorkerSocketEmitter.instance = new WorkerSocketEmitter()
        }
        return WorkerSocketEmitter.instance
    }

    public async init(): Promise<void> {
        this.io = new Server() // standalone, emit-only (no httpServer.listen)

        // Same Redis adapter as the web process so worker-side emits (run streaming, cache invalidation)
        // reach browser clients connected on the web instances. Redis is required; failure is fatal.
        this.pub = createClient({ url: redis.url })
        this.sub = this.pub.duplicate()
        await this.pub.connect()
        await this.sub.connect()
        this.io.adapter(createAdapter(this.pub, this.sub, { key: RedisNamespace.socketio }))
        logger.info("✅ Worker Socket.IO Redis adapter connected (emit-only)")
    }

    public getSocket(): Server | null {
        return this.io
    }

    public async close(): Promise<void> {
        try {
            await this.io?.close()
        } catch (error) {
            logger.warn("Worker Socket.IO close failed (emit-only server)", { error })
        }
        await Promise.allSettled([this.pub?.quit(), this.sub?.quit()])
        this.io = null
        this.pub = null
        this.sub = null
    }
}

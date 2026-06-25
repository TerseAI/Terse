import "dotenv/config"
import { createServer } from "http"

import { createApp } from "./app"
import { analytics } from "./common/analytics"
import { buildCorsAllowedOrigins } from "./common/corsOrigins"
// Import to trigger listener registration
import logger from "./common/logger"
import "./integrations/IntegrationTaskHandler"
import { setupSlackBolt } from "./integrations/slack/boltApp"
import { closeQueues } from "./loaders/bullmq"
import { db } from "./loaders/prisma"
import { getRealtimeSocket, initializeRealtimeSocket } from "./loaders/socket"
import { setupLLMAnalytics } from "./modules/agents/openaiInstance"
import { RateLimiterClient } from "./rateLimit/RateLimiterClient"
import { registerSocketGetter } from "./services/CacheInvalidationService"
import { closeTaskQueuePubSub } from "./tasks/abstract/redisTaskQueue"

// MARK: ASYNC INITIALIZATION
// Bootstrap async dependencies before the Express app is built.

const corsAllowedOrigins = buildCorsAllowedOrigins()
logger.info("CORS allowlist initialized", { origins: [...corsAllowedOrigins].sort() })

const rateLimiter = RateLimiterClient.getInstance()
try {
    await rateLimiter.init()
} catch (error) {
    logger.error("❌ Failed to initialize rate limiter", { error })
    process.exit(1)
}

// Slack Bolt — must complete before app is built so the receiver router can be mounted.
const slackReceiver: Awaited<ReturnType<typeof setupSlackBolt>> | null = await setupSlackBolt()

setupLLMAnalytics()

// MARK: APP + HTTP SERVER

const app = createApp({ corsAllowedOrigins, slackReceiver })
const server = createServer(app)

try {
    await initializeRealtimeSocket(server, corsAllowedOrigins)
    registerSocketGetter(getRealtimeSocket)
    logger.info("✅ Socket.IO server initialized")
} catch (error) {
    logger.error("❌ Failed to initialize Socket.IO server", { error })
    process.exit(1)
}

// MARK: LIFECYCLE

process.on("unhandledRejection", (reason: unknown) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    logger.error("❌ Unhandled Promise Rejection (safety net)", { error: errorMessage, stack })
})

server.listen(3001, () => {
    logger.info("🚀 Express backend running on http://localhost:3001")
})

const SHUTDOWN_GRACE_MS = 25_000
let shuttingDown = false

async function gracefulShutdown(signal: string) {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`🛑 ${signal} received — starting graceful shutdown (grace ${SHUTDOWN_GRACE_MS}ms)`)

    const forceExit = setTimeout(() => {
        logger.error("⏰ Graceful shutdown timed out — forcing exit")
        process.exit(1)
    }, SHUTDOWN_GRACE_MS)
    forceExit.unref()

    try {
        const io = getRealtimeSocket()
        const httpClosed = io ? new Promise<void>(resolve => io.close(() => resolve())) : new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())))

        if (typeof server.closeIdleConnections === "function") {
            server.closeIdleConnections()
            logger.info("Evicted idle keep-alive connections")
        }

        logger.info("Waiting for in-flight requests to drain")
        await httpClosed
        logger.info("✅ HTTP server closed")

        try {
            await analytics.shutdown()
            logger.info("✅ Analytics flushed")
        } catch (error) {
            logger.error("Analytics shutdown failed", { error })
        }

        try {
            await closeTaskQueuePubSub()
            await closeQueues()
            logger.info("✅ Redis queues + pub/sub closed")
        } catch (error) {
            logger.error("Redis shutdown failed", { error })
        }

        try {
            await db().$disconnect()
            logger.info("✅ Prisma disconnected")
        } catch (error) {
            logger.error("Prisma disconnect failed", { error })
        }

        logger.info("👋 Graceful shutdown complete")
        clearTimeout(forceExit)
        process.exit(0)
    } catch (error) {
        logger.error("Graceful shutdown error", { error })
        clearTimeout(forceExit)
        process.exit(1)
    }
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => void gracefulShutdown("SIGINT"))

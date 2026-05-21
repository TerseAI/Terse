import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import "dotenv/config"
import express, { NextFunction, Request, Response } from "express"
import { createServer } from "http"
import { ApiRoutes } from "terse-types"

import { setupLLMAnalytics } from "./agent/openaiInstance"
// Import settings early to validate environment variables at startup
import { requestSessionSocketToken } from "./agent/socket"
import { settings } from "./config/settings"
import apiTokensRouter from "./domains/api-tokens/routes"
import approvalsRouter from "./domains/approvals/routes"
import authRouter from "./domains/auth/routes"
import billingRouter from "./domains/billing/routes"
import improvementsRouter from "./domains/improvements/routes"
import attioRouter from "./domains/integrations/attio/routes"
import datadogRouter from "./domains/integrations/datadog/routes"
import githubVendorRouter from "./domains/integrations/github/routes"
import gmailRouter from "./domains/integrations/gmail/routes"
import heyreachRouter from "./domains/integrations/heyreach/routes"
import launchdarklyRouter from "./domains/integrations/launchdarkly/routes"
import linearRouter from "./domains/integrations/linear/routes"
import notionRouter from "./domains/integrations/notion/routes"
import posthogRouter from "./domains/integrations/posthog/routes"
import integrationsRouter from "./domains/integrations/routes"
import slackVendorRouter from "./domains/integrations/slack/routes"
import snowflakeRouter from "./domains/integrations/snowflake/routes"
import workosIntegrationRouter from "./domains/integrations/workosIntegration/routes"
import notificationDestinationsRouter from "./domains/notifications/destinations/routes"
import sentNotificationsRouter from "./domains/notifications/sent/routes"
import notificationSettingsRouter from "./domains/notifications/settings/routes"
import organizationsRouter from "./domains/organizations/routes"
import { handleProjectCreate } from "./domains/projects/controller"
import projectsRouter from "./domains/projects/routes"
import projectSecretsRouter from "./domains/projects/secrets/routes"
import runsRouter from "./domains/runs/routes"
import sdkMaintenanceRouter from "./domains/sdk/maintenance/routes"
import sdkRouter from "./domains/sdk/routes"
import statsRouter from "./domains/stats/routes"
import toolsRouter from "./domains/tools/routes"
import usersRouter from "./domains/users/routes"
import "./integrations/IntegrationTaskHandler"
// Import to trigger listener registration
import logger from "./logger"
import { db } from "./prismaClient"
import { RateLimiterClient } from "./rateLimit/RateLimiterClient"
import { RateLimitKind, rateLimit } from "./rateLimit/routeLimits"
import { getRealtimeSocket, initializeRealtimeSocket } from "./realtimeSocket"
import { deleteAgent, getAgentFileContent, getAgentFiles, getRecentAgents, getUserAgent, getUserAgents, updateAgent } from "./routes/agents"
import { handleAttioWebhook } from "./routes/attio"
import { invalidateBillingCachesFromService } from "./routes/billingCacheInvalidation"
import { githubAppUnifiedEvent } from "./routes/github"
import { handleGmailWebhook } from "./routes/gmail"
import { handleHeyReachWebhook } from "./routes/heyreach"
import { handleLinearWebhook } from "./routes/linear"
import { clearOldSecretVersions, refreshAllTokens } from "./routes/refreshTokens"
import { reviewAllAgents } from "./routes/reviewAgents"
import { handleManualTrigger, handleScheduleWebhook, handleTriggerWithEvent, handleWebMonitorWebhook } from "./routes/schedule"
import { handleWebhookTrigger } from "./routes/webhookTrigger"
import { handleWorkOSWebhook } from "./routes/workos"
import { handleWorkOSTriggerWebhook } from "./routes/workosIntegration"
import { registerSocketGetter } from "./services/CacheInvalidationService"
import { setupSlackBolt } from "./slack/boltApp"
import { analytics } from "./utility/analytics"
import { AuthKind, requireAuth } from "./utility/authMiddleware"
import { buildCorsAllowedOrigins, isCorsOriginAllowed } from "./utility/corsOrigins"
import { httpAccessLog } from "./utility/httpAccessLog"
import { workos } from "./utility/workos"

const app = express()

app.set("trust proxy", 1)

app.use(httpAccessLog)

const server = createServer(app)

const corsAllowedOrigins = buildCorsAllowedOrigins()
logger.info("CORS allowlist initialized", { origins: [...corsAllowedOrigins].sort() })

try {
    await initializeRealtimeSocket(server, corsAllowedOrigins)
    registerSocketGetter(getRealtimeSocket)
    logger.info("✅ Socket.IO server initialized")
} catch (error) {
    logger.error("❌ Failed to initialize Socket.IO server", { error })
    process.exit(1)
}

// Initialize rate limiter (Redis-backed in prod, in-memory locally).
// Must complete before any route is registered.
const rateLimiter = RateLimiterClient.getInstance()
try {
    await rateLimiter.init()
} catch (error) {
    logger.error("❌ Failed to initialize rate limiter", { error })
    process.exit(1)
}

// Initialize Slack Bolt app
const slackReceiver: Awaited<ReturnType<typeof setupSlackBolt>> | null = await setupSlackBolt()

// Initialize LLM analytics
setupLLMAnalytics()

app.use(
    cors({
        credentials: true,
        origin(origin, callback) {
            if (isCorsOriginAllowed(origin, corsAllowedOrigins)) {
                callback(null, true)
                return
            }
            logger.warn("CORS request blocked", { origin })
            callback(null, false)
        }
    })
)

app.get(settings.health.checkPath, async (_req, res) => {
    res.status(200).json({ ok: true })
})

if (slackReceiver?.receiver) {
    app.use("/slack", slackReceiver.receiver.router)
    logger.info("✅ Slack Bolt router mounted at /slack")
}

// Routes that need larger body limits for webhooks with potentially large payloads
const LARGE_BODY_LIMIT_ROUTES: string[] = [ApiRoutes.GITHUB.UNIFIED_EVENT, ApiRoutes.SDK.DEPLOY]
const LARGE_BODY_LIMIT = "10mb"
const DEFAULT_BODY_LIMIT = "1mb"

// Parse JSON for all routes except Slack events, Linear webhook, and WorkOS webhook (which need raw body for signature verification)
app.use((req, res, next) => {
    if (
        req.path === "/slack/events" ||
        req.path === "/linear/webhook" ||
        req.path === ApiRoutes.WEBHOOKS.WORKOS ||
        req.path.startsWith("/webhooks/workos-trigger/") ||
        req.path.startsWith("/webhooks/webmonitor/") ||
        req.path.startsWith("/webhooks/attio/")
    ) {
        next()
    } else {
        // Use larger limit for webhook routes that may receive large payloads (e.g., GitHub PR events with large bodies)
        const limit = LARGE_BODY_LIMIT_ROUTES.includes(req.path) ? LARGE_BODY_LIMIT : DEFAULT_BODY_LIMIT
        bodyParser.json({ limit })(req, res, next)
    }
})

// Error handling middleware for body-parser errors (must be after body parsing middleware)
// This catches PayloadTooLargeError and other body parsing errors
app.use((err: Error & { type?: string; statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
    // Handle payload too large errors
    if (err.type === "entity.too.large") {
        const contentLength = req.get("content-length")
        logger.warn("[Webhook] Payload too large", {
            path: req.path,
            method: req.method,
            contentLength: contentLength ? parseInt(contentLength) : undefined,
            contentType: req.get("content-type"),
            ip: req.ip || req.socket.remoteAddress || "unknown",
            userAgent: req.get("user-agent")
        })
        return res.status(413).json({
            error: "Payload too large",
            message: `Request body exceeded the maximum allowed size. Path: ${req.path}`
        })
    }

    // Handle JSON syntax errors
    if (err instanceof SyntaxError && err.statusCode === 400 && "body" in err) {
        logger.warn("[Request] Invalid JSON body", {
            path: req.path,
            method: req.method,
            error: err.message
        })
        return res.status(400).json({
            error: "Invalid JSON",
            message: "Request body contains invalid JSON"
        })
    }

    // Pass other errors to the next error handler
    next(err)
})
app.use(cookieParser())

// MARK: CRON JOBS

app.post(ApiRoutes.REFRESH_TOKENS, requireAuth([AuthKind.CloudScheduler]), async (req, res) => {
    refreshAllTokens(req, res)
})

app.post(ApiRoutes.CLEAR_OLD_SECRET_VERSIONS, requireAuth([AuthKind.CloudScheduler]), async (req, res) => {
    clearOldSecretVersions(req, res)
})

app.post(ApiRoutes.REVIEW_AGENTS, requireAuth([AuthKind.CloudScheduler]), async (req, res) => {
    reviewAllAgents(req, res)
})

// MARK: WEBHOOKS (each handler verifies its own provider signature)

app.post(ApiRoutes.WEBHOOKS.GMAIL, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    handleGmailWebhook(req, res)
})

// Linear webhook needs raw body for signature verification
app.use(ApiRoutes.LINEAR.WEBHOOK, express.raw({ type: "application/json" }))

app.post(ApiRoutes.LINEAR.WEBHOOK, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    handleLinearWebhook(req, res)
})

// WorkOS webhook needs raw body for signature verification
app.use(ApiRoutes.WEBHOOKS.WORKOS, express.raw({ type: "application/json" }))

app.post(ApiRoutes.WEBHOOKS.WORKOS, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    handleWorkOSWebhook(req, res)
})

// WorkOS Trigger webhook needs raw body for signature verification
app.use(ApiRoutes.WEBHOOKS.WORKOS_TRIGGER_BY_INTEGRATION_ID, express.raw({ type: "application/json" }))

app.post(ApiRoutes.WEBHOOKS.WORKOS_TRIGGER_BY_INTEGRATION_ID, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    handleWorkOSTriggerWebhook(req, res)
})

app.post(ApiRoutes.WEBHOOKS.SCHEDULE_BY_INPUT_ID, requireAuth([AuthKind.CloudScheduler]), async (req, res) => {
    handleScheduleWebhook(req, res)
})

app.use(ApiRoutes.WEBHOOKS.WEBMONITOR_BY_INPUT_ID, express.raw({ type: "application/json", limit: LARGE_BODY_LIMIT }))

app.post(ApiRoutes.WEBHOOKS.WEBMONITOR_BY_INPUT_ID, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    handleWebMonitorWebhook(req, res)
})

app.post(ApiRoutes.WEBHOOKS.WEBHOOK_TRIGGER_BY_TOKEN, rateLimit(RateLimitKind.WebhookByToken), async (req, res) => {
    handleWebhookTrigger(req, res)
})

app.post(ApiRoutes.WEBHOOKS.HEY_REACH_BY_INTEGRATION_ID, rateLimit(RateLimitKind.HeyReachByTrigger), async (req, res) => {
    handleHeyReachWebhook(req, res)
})

// Attio webhook needs raw body for HMAC-SHA256 signature verification
app.use(ApiRoutes.WEBHOOKS.ATTIO_BY_TRIGGER_ID, express.raw({ type: "application/json" }))

app.post(ApiRoutes.WEBHOOKS.ATTIO_BY_TRIGGER_ID, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    handleAttioWebhook(req, res)
})

app.post(ApiRoutes.GITHUB.UNIFIED_EVENT, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    await githubAppUnifiedEvent(req, res)
})

// Billing service callback: uses a service JWT, not bearer API token auth.
app.post(ApiRoutes.BILLING.CACHE_INVALIDATION, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    await invalidateBillingCachesFromService(req, res)
})

// MARK: DOMAIN ROUTERS (MVC — controller/service/repository per domain)
app.use("/stats", statsRouter)
app.use("/run-history", runsRouter)
app.use("/users", usersRouter)
app.use("/pending-approvals", approvalsRouter)
app.use("/notification-destinations", notificationDestinationsRouter)
app.use("/notification-settings", notificationSettingsRouter)
app.use("/sent-notifications", sentNotificationsRouter)
app.use("/billing", billingRouter)
app.use("/projects/:id/secrets", projectSecretsRouter)
app.use("/projects", projectsRouter)
app.use("/api-tokens", apiTokensRouter)
app.use("/organizations", organizationsRouter)
app.use("/agents/:agentId", improvementsRouter)
app.use("/tools", toolsRouter)
app.use("/integrations", integrationsRouter)
app.use("/sdk", sdkRouter)
app.use(sdkMaintenanceRouter)
app.use(authRouter)
// Per-vendor integration routers (mounted at vendor-specific prefixes)
app.use("/attio", attioRouter)
app.use("/datadog", datadogRouter)
app.use("/github", githubVendorRouter)
app.use("/gmail", gmailRouter)
app.use("/heyreach", heyreachRouter)
app.use("/launchdarkly", launchdarklyRouter)
app.use("/linear", linearRouter)
app.use("/notion", notionRouter)
app.use("/posthog", posthogRouter)
app.use("/slack", slackVendorRouter)
app.use("/snowflake", snowflakeRouter)
app.use("/workos-integration", workosIntegrationRouter)

// MARK: SESSION

app.get(ApiRoutes.SESSION.TOKEN, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    requestSessionSocketToken(req, res)
})

// Manual trigger endpoints (authenticated, used by SDK and UI)
app.post(ApiRoutes.SCHEDULE.TRIGGER_BY_INPUT_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleManualTrigger(req, res)
})

app.post(ApiRoutes.SCHEDULE.TRIGGER_WITH_EVENT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleTriggerWithEvent(req, res)
})

// MARK: AGENTS

app.get("/agents", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getUserAgents(req, res)
})

app.get("/agents/recent", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getRecentAgents(req, res)
})

app.get(ApiRoutes.AGENTS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getUserAgent(req, res)
})

app.patch(ApiRoutes.AGENTS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    updateAgent(req, res)
})

app.delete(ApiRoutes.AGENTS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    deleteAgent(req, res)
})

app.get(ApiRoutes.AGENTS.FILES, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getAgentFiles(req, res)
})

app.get(ApiRoutes.AGENTS.FILE_CONTENT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getAgentFileContent(req, res)
})

/**
 * Express error handling middleware - MUST be last, after all routes
 * This catches errors from async route handlers
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error("❌ Express Error Handler", {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    })
    res.status(500).json({
        error: "Internal server error"
    })
})

// Global unhandled rejection handler - safety net for fire-and-forget promises
// This catches any promises that reject without a .catch() handler
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    logger.error("❌ Unhandled Promise Rejection (safety net)", {
        error: errorMessage,
        stack
    })
    // Log but don't crash - this is a safety net for promises we might have missed
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
        const httpClosed = io
            ? new Promise<void>(resolve => io.close(() => resolve())) // disconnects Socket.IO clients AND closes underlying HTTP server
            : new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())))

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

import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import express, { NextFunction, Request, Response } from "express"
import { ApiRoutes } from "terse-types"

import { requestSessionSocketToken } from "./agent/socket"
import { settings } from "./settings"
import agentsReviewRouter from "./domains/agents/review/routes"
import agentsRouter from "./domains/agents/routes"
import apiTokensRouter from "./domains/api-tokens/routes"
import approvalsRouter from "./domains/approvals/routes"
import authRouter from "./domains/auth/routes"
import billingCacheInvalidationRouter from "./domains/billing/cache-invalidation/routes"
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
import maintenanceRouter from "./domains/maintenance/routes"
import notificationDestinationsRouter from "./domains/notifications/destinations/routes"
import sentNotificationsRouter from "./domains/notifications/sent/routes"
import notificationSettingsRouter from "./domains/notifications/settings/routes"
import organizationsRouter from "./domains/organizations/routes"
import projectsRouter from "./domains/projects/routes"
import projectSecretsRouter from "./domains/projects/secrets/routes"
import runsRouter from "./domains/runs/routes"
import sdkMaintenanceRouter from "./domains/sdk/maintenance/routes"
import sdkRouter from "./domains/sdk/routes"
import statsRouter from "./domains/stats/routes"
import toolsRouter from "./domains/tools/routes"
import triggersRouter from "./domains/triggers/routes"
import usersRouter from "./domains/users/routes"
import logger from "./common/logger"
import { RateLimitKind, rateLimit } from "./rateLimit/routeLimits"
import { handleAttioWebhook } from "./domains/integrations/attio/controller"
import { githubAppUnifiedEvent } from "./domains/integrations/github/controller"
import { handleGmailWebhook } from "./domains/integrations/gmail/controller"
import { handleHeyReachWebhook } from "./domains/integrations/heyreach/controller"
import { handleLinearWebhook } from "./domains/integrations/linear/controller"
import { handleWorkOSWebhook } from "./domains/integrations/workos/controller"
import { handleWorkOSTriggerWebhook } from "./domains/integrations/workosIntegration/controller"
import { setupSlackBolt } from "./slack/boltApp"
import { AuthKind, requireAuth } from "./domains/auth/helpers/authMiddleware"
import { isCorsOriginAllowed } from "./common/corsOrigins"
import { httpAccessLog } from "./middlewares/httpAccessLog"

type SlackReceiver = Awaited<ReturnType<typeof setupSlackBolt>>

export interface CreateAppOptions {
    /** Cors allowlist built by buildCorsAllowedOrigins(). */
    corsAllowedOrigins: Set<string>
    /** Slack Bolt receiver from setupSlackBolt(). Mounted at /slack if provided. */
    slackReceiver: SlackReceiver | null
}

const LARGE_BODY_LIMIT_ROUTES: string[] = [ApiRoutes.GITHUB.UNIFIED_EVENT, ApiRoutes.SDK.DEPLOY]
const LARGE_BODY_LIMIT = "10mb"
const DEFAULT_BODY_LIMIT = "1mb"

/**
 * Build the Express application with all middleware + routes wired up.
 * Pure function — no async init, no listen, no process-level side effects.
 *
 * Async dependencies (Socket.IO, rate limiter, Slack Bolt, LLM analytics)
 * are initialized in server.ts and either passed in here as options or
 * registered as singletons before this function is called.
 */
export function createApp(options: CreateAppOptions) {
    const { corsAllowedOrigins, slackReceiver } = options
    const app = express()

    app.set("trust proxy", 1)
    app.use(httpAccessLog)

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

    // Parse JSON for all routes except routes that need raw body for signature verification.
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
            const limit = LARGE_BODY_LIMIT_ROUTES.includes(req.path) ? LARGE_BODY_LIMIT : DEFAULT_BODY_LIMIT
            bodyParser.json({ limit })(req, res, next)
        }
    })

    // Body-parser error handling (must come right after body parsing middleware)
    app.use((err: Error & { type?: string; statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
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

        if (err instanceof SyntaxError && err.statusCode === 400 && "body" in err) {
            logger.warn("[Request] Invalid JSON body", { path: req.path, method: req.method, error: err.message })
            return res.status(400).json({ error: "Invalid JSON", message: "Request body contains invalid JSON" })
        }

        next(err)
    })
    app.use(cookieParser())

    // MARK: WEBHOOKS — each handler verifies its own provider signature, some need raw body

    app.post(ApiRoutes.WEBHOOKS.GMAIL, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
        handleGmailWebhook(req, res)
    })

    app.use(ApiRoutes.LINEAR.WEBHOOK, express.raw({ type: "application/json" }))
    app.post(ApiRoutes.LINEAR.WEBHOOK, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
        handleLinearWebhook(req, res)
    })

    app.use(ApiRoutes.WEBHOOKS.WORKOS, express.raw({ type: "application/json" }))
    app.post(ApiRoutes.WEBHOOKS.WORKOS, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
        handleWorkOSWebhook(req, res)
    })

    app.use(ApiRoutes.WEBHOOKS.WORKOS_TRIGGER_BY_INTEGRATION_ID, express.raw({ type: "application/json" }))
    app.post(ApiRoutes.WEBHOOKS.WORKOS_TRIGGER_BY_INTEGRATION_ID, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
        handleWorkOSTriggerWebhook(req, res)
    })

    app.post(ApiRoutes.WEBHOOKS.HEY_REACH_BY_INTEGRATION_ID, rateLimit(RateLimitKind.HeyReachByTrigger), async (req, res) => {
        handleHeyReachWebhook(req, res)
    })

    app.use(ApiRoutes.WEBHOOKS.ATTIO_BY_TRIGGER_ID, express.raw({ type: "application/json" }))
    app.post(ApiRoutes.WEBHOOKS.ATTIO_BY_TRIGGER_ID, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
        handleAttioWebhook(req, res)
    })

    app.post(ApiRoutes.GITHUB.UNIFIED_EVENT, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
        await githubAppUnifiedEvent(req, res)
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
    app.use("/agents", agentsRouter)
    app.use("/tools", toolsRouter)
    app.use(triggersRouter)
    app.use("/integrations", integrationsRouter)
    app.use("/sdk", sdkRouter)
    app.use(sdkMaintenanceRouter)
    app.use(agentsReviewRouter)
    app.use(maintenanceRouter)
    app.use(billingCacheInvalidationRouter)
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

    /**
     * Express error handling middleware — MUST be last, after all routes.
     * Catches errors from async route handlers.
     */
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        logger.error("❌ Express Error Handler", {
            error: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method
        })
        res.status(500).json({ error: "Internal server error" })
    })

    return app
}

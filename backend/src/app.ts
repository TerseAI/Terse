import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import express, { NextFunction, Request, Response } from "express"
import helmet from "helmet"
import { ApiRoutes } from "terse-types"
import { IntegrationType } from "terse-types/Integrations"

import { isCorsOriginAllowed } from "./common/corsOrigins"
import logger from "./common/logger"
import { handleWorkOSWebhook } from "./ee/services/authProvider/workosWebhook"
import { IntegrationRegistry } from "./integrations/abstract/IntegrationRegistry"
import { setupSlackBolt } from "./integrations/slack/boltApp"
import { httpAccessLog } from "./middlewares/httpAccessLog"
import agentsRouter from "./modules/agents/routes"
import apiTokensRouter from "./modules/api-tokens/routes"
import approvalsRouter from "./modules/approvals/routes"
import { AuthKind, requireAuth } from "./modules/auth/helpers/authMiddleware"
import authRouter from "./modules/auth/routes"
import billingCacheInvalidationRouter from "./modules/billing/cache-invalidation/routes"
import billingRouter from "./modules/billing/routes"
import improvementsRouter from "./modules/improvements/routes"
import apolloRouter from "./modules/integrations/apollo/routes"
import { handleAttioWebhook } from "./modules/integrations/attio/controller"
import attioRouter from "./modules/integrations/attio/routes"
import datadogRouter from "./modules/integrations/datadog/routes"
import { githubAppCallbackIntegrate, githubAppUnifiedEvent } from "./modules/integrations/github/controller"
import githubVendorRouter from "./modules/integrations/github/routes"
import { handleGmailWebhook } from "./modules/integrations/gmail/controller"
import gmailRouter from "./modules/integrations/gmail/routes"
import googleSearchConsoleRouter from "./modules/integrations/googlesearchconsole/routes"
import { handleHeyReachWebhook } from "./modules/integrations/heyreach/controller"
import heyreachRouter from "./modules/integrations/heyreach/routes"
import launchdarklyRouter from "./modules/integrations/launchdarkly/routes"
import { handleLinearWebhook } from "./modules/integrations/linear/controller"
import linearRouter from "./modules/integrations/linear/routes"
import metaAdsRouter from "./modules/integrations/metaAds/routes"
import notionRouter from "./modules/integrations/notion/routes"
import posthogRouter from "./modules/integrations/posthog/routes"
import higgsfieldRouter from "./modules/integrations/higgsfield/routes"
import resendRouter from "./modules/integrations/resend/routes"
import integrationsRouter from "./modules/integrations/routes"
import slackVendorRouter from "./modules/integrations/slack/routes"
import snowflakeRouter from "./modules/integrations/snowflake/routes"
import { handleWorkOSTriggerWebhook } from "./modules/integrations/workosIntegration/controller"
import workosIntegrationRouter from "./modules/integrations/workosIntegration/routes"
import notificationDestinationsRouter from "./modules/notifications/destinations/routes"
import sentNotificationsRouter from "./modules/notifications/sent/routes"
import notificationSettingsRouter from "./modules/notifications/settings/routes"
import organizationsRouter from "./modules/organizations/routes"
import projectsRouter from "./modules/projects/routes"
import projectSecretsRouter from "./modules/projects/secrets/routes"
import runsRouter from "./modules/runs/routes"
import sdkRouter from "./modules/sdk/routes"
import statsRouter from "./modules/stats/routes"
import toolsRouter from "./modules/tools/routes"
import triggersRouter from "./modules/triggers/routes"
import usersRouter from "./modules/users/routes"
import { RateLimitKind, rateLimit } from "./rateLimit/routeLimits"
import { getAuthProvider } from "./services/authProvider"
import { settings } from "./settings"

type SlackReceiver = Awaited<ReturnType<typeof setupSlackBolt>>

export interface CreateAppOptions {
    corsAllowedOrigins: Set<string>
    slackReceiver: SlackReceiver | null
}

const LARGE_BODY_LIMIT_ROUTES: string[] = [ApiRoutes.GITHUB.UNIFIED_EVENT, ApiRoutes.SDK.DEPLOY]
const LARGE_BODY_LIMIT = "10mb"
const DEFAULT_BODY_LIMIT = "1mb"

function isIntegrationAvailable(type: IntegrationType): boolean {
    return IntegrationRegistry.getInstance()
        .all()
        .some(m => m.integrationType === type)
}

export function createApp(options: CreateAppOptions) {
    const { corsAllowedOrigins, slackReceiver } = options
    const app = express()
    app.use(helmet())
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

    // Mark authed responses no-store so a future CDN/proxy doesn't retain them.
    app.use((req, res, next) => {
        if (req.headers.cookie || req.headers.authorization) {
            res.setHeader("Cache-Control", "no-store")
        }
        next()
    })

    // MARK: WEBHOOKS — each handler verifies its own provider signature, some need raw body.
    // Each route is gated on the corresponding integration being available so disabled
    // integrations get a clean 404 instead of a 500 from missing config.

    if (isIntegrationAvailable(IntegrationType.GMAIL)) {
        app.post(ApiRoutes.WEBHOOKS.GMAIL, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
            handleGmailWebhook(req, res)
        })
    }

    if (isIntegrationAvailable(IntegrationType.LINEAR)) {
        app.use(ApiRoutes.LINEAR.WEBHOOK, express.raw({ type: "application/json" }))
        app.post(ApiRoutes.LINEAR.WEBHOOK, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
            handleLinearWebhook(req, res)
        })
    }

    // Allow AuthProvider to register its own routes
    getAuthProvider().registerRoutes?.(app)

    if (isIntegrationAvailable(IntegrationType.WORKOS)) {
        app.use(ApiRoutes.WEBHOOKS.WORKOS_TRIGGER_BY_INTEGRATION_ID, express.raw({ type: "application/json" }))
        app.post(ApiRoutes.WEBHOOKS.WORKOS_TRIGGER_BY_INTEGRATION_ID, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
            handleWorkOSTriggerWebhook(req, res)
        })
    }

    if (isIntegrationAvailable(IntegrationType.HEY_REACH)) {
        app.post(ApiRoutes.WEBHOOKS.HEY_REACH_BY_INTEGRATION_ID, rateLimit(RateLimitKind.HeyReachByTrigger), async (req, res) => {
            handleHeyReachWebhook(req, res)
        })
    }

    if (isIntegrationAvailable(IntegrationType.ATTIO)) {
        app.use(ApiRoutes.WEBHOOKS.ATTIO_BY_TRIGGER_ID, express.raw({ type: "application/json" }))
        app.post(ApiRoutes.WEBHOOKS.ATTIO_BY_TRIGGER_ID, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
            handleAttioWebhook(req, res)
        })
    }

    if (isIntegrationAvailable(IntegrationType.GITHUB)) {
        app.post(ApiRoutes.GITHUB.UNIFIED_EVENT, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
            await githubAppUnifiedEvent(req, res)
        })
        app.get(ApiRoutes.AUTH.GITHUB_APP_CALLBACK, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
            await githubAppCallbackIntegrate(req, res)
        })
    }

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
    app.use(billingCacheInvalidationRouter)
    app.use(authRouter)
    // Per-vendor integration routers (mounted at vendor-specific prefixes). Gated on
    // integration availability so unconfigured providers return a clean 404.
    if (isIntegrationAvailable(IntegrationType.APOLLO)) app.use("/apollo", apolloRouter)
    if (isIntegrationAvailable(IntegrationType.ATTIO)) app.use("/attio", attioRouter)
    if (isIntegrationAvailable(IntegrationType.DATADOG)) app.use("/datadog", datadogRouter)
    if (isIntegrationAvailable(IntegrationType.GITHUB)) app.use("/github", githubVendorRouter)
    if (isIntegrationAvailable(IntegrationType.GMAIL)) app.use("/gmail", gmailRouter)
    if (isIntegrationAvailable(IntegrationType.GOOGLE_SEARCH_CONSOLE)) app.use("/google-search-console", googleSearchConsoleRouter)
    if (isIntegrationAvailable(IntegrationType.HEY_REACH)) app.use("/heyreach", heyreachRouter)
    if (isIntegrationAvailable(IntegrationType.LAUNCHDARKLY)) app.use("/launchdarkly", launchdarklyRouter)
    if (isIntegrationAvailable(IntegrationType.LINEAR)) app.use("/linear", linearRouter)
    if (isIntegrationAvailable(IntegrationType.META_ADS)) app.use("/meta-ads", metaAdsRouter)
    if (isIntegrationAvailable(IntegrationType.NOTION)) app.use("/notion", notionRouter)
    if (isIntegrationAvailable(IntegrationType.POSTHOG)) app.use("/posthog", posthogRouter)
    if (isIntegrationAvailable(IntegrationType.RESEND)) app.use("/resend", resendRouter)
    if (isIntegrationAvailable(IntegrationType.HIGGSFIELD)) app.use("/higgsfield", higgsfieldRouter)
    if (isIntegrationAvailable(IntegrationType.SLACK)) app.use("/slack", slackVendorRouter)
    if (isIntegrationAvailable(IntegrationType.SNOWFLAKE)) app.use("/snowflake", snowflakeRouter)
    if (isIntegrationAvailable(IntegrationType.WORKOS)) app.use("/workos-integration", workosIntegrationRouter)

    // MARK: SESSION
    app.get(ApiRoutes.SESSION.TOKEN, rateLimit(RateLimitKind.SessionToken), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
        getAuthProvider().requestSessionSocketToken(req, res)
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

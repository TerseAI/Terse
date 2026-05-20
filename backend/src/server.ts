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
import "./integrations/IntegrationTaskHandler"
// Import to trigger listener registration
import logger from "./logger"
import { db } from "./prismaClient"
import { RateLimiterClient } from "./rateLimit/RateLimiterClient"
import { RateLimitKind, rateLimit } from "./rateLimit/routeLimits"
import { getRealtimeSocket, initializeRealtimeSocket } from "./realtimeSocket"
import { deleteAgent, getAgentFileContent, getAgentFiles, getRecentAgents, getUserAgent, getUserAgents, updateAgent } from "./routes/agents"
import { createApiToken, deleteApiToken, getApiTokens, updateApiToken } from "./routes/apiTokens"
import { attioOAuthCallback, getAttioIntegrations, getAttioObjects, handleAttioWebhook } from "./routes/attio"
import { callback, getWorkOSWidgetToken, login, loginUrl, logout, logoutUrl, me } from "./routes/auth"
import { githubAppCallbackIntegrate } from "./routes/auth/githubAuth"
import { changeBillingSubscription, createBillingCheckoutSession, createBillingPortalSession, getBillingCatalog, getBillingContext, getBillingStatus, getBillingUsageBuckets } from "./routes/billing"
import { invalidateBillingCachesFromService } from "./routes/billingCacheInvalidation"
import { cleanupSdkImages } from "./routes/cleanupSdkImages"
import { createOrUpdateDatadogIntegration, getDatadogIndexes, getDatadogIntegrations } from "./routes/datadog"
import { deviceTokenExchange, identify, listMyOrganizations, switchOrganization as sdkSwitchOrganization } from "./routes/deviceTokenExchange"
import { getGithubIntegrations, getGithubRepositoriesForIntegration, githubAppUnifiedEvent } from "./routes/github"
import { deleteGmailIntegration, getGmailIntegrations, gmailCallback, handleGmailWebhook } from "./routes/gmail"
import { createOrUpdateHeyReachIntegration, getHeyReachCampaigns, getHeyReachIntegrations, handleHeyReachWebhook } from "./routes/heyreach"
import { handleHydrateSampleEvent } from "./routes/hydrateSampleEvent"
import { applyImprovement, dismissImprovement, getAgentImprovements, toggleImprovementsEnabled, undoDismissImprovement } from "./routes/improvements"
import { disconnectIntegration, getActiveIntegrations, getAllIntegrations, getIntegrationInstallationDetails } from "./routes/integrations"
import { createOrUpdateLaunchDarklyIntegration, getLaunchDarklyEnvironments, getLaunchDarklyIntegrations, getLaunchDarklyProjects } from "./routes/launchdarkly"
import { getLinearIntegrations, getLinearProjects, getLinearTeams, handleLinearWebhook, linearOAuthCallback } from "./routes/linear"
import { createNotificationDestination, deleteNotificationDestination, getNotificationDestinations, updateNotificationDestination } from "./routes/notificationDestinations"
import { getNotificationSettings, updateNotificationSettings } from "./routes/notificationSettings"
import { getNotionIntegrations, getNotionResources, notionOAuthCallback } from "./routes/notion"
import { createOrganization, getCurrentOrganization, getLogoUploadUrl, getLogoUrl, getUserOrganizations, switchOrganization, updateOrganization } from "./routes/organization"
import { getPendingApprovals } from "./routes/pendingApprovals"
import { createOrUpdatePosthogIntegration, getPosthogIntegrations, getPosthogProjects } from "./routes/posthog"
import {
    handleGetProjectById,
    handleGetProjectDeploys,
    handleGetProjectSourceFileContent,
    handleGetProjectSourceFiles,
    handleListProjects,
    handleProjectCreate,
    handleProjectDelete,
    handleRotateProjectApiKey,
    handleRotateProjectSigningSecret
} from "./routes/project"
import { handleDeleteProjectSecret, handleImportProjectSecrets, handleListProjectSecrets, handleUpsertProjectSecret } from "./routes/projectSecrets"
import { clearOldSecretVersions, refreshAllTokens } from "./routes/refreshTokens"
import { reviewAllAgents } from "./routes/reviewAgents"
import { getAllRunHistory, getChatHistory, getRunHistory, getRunHistoryActions } from "./routes/runHistory"
import { handleSampleEvents } from "./routes/sampleEvents"
import { handleManualTrigger, handleScheduleWebhook, handleTriggerWithEvent, handleWebMonitorWebhook } from "./routes/schedule"
import { handleSdkAgentRun, handleSdkApprovalDecision } from "./routes/sdkAgentRun"
import { handleSdkDeploy } from "./routes/sdkDeploy"
import { handleSdkIntegrationFields, handleSdkIntegrationFormSubmit } from "./routes/sdkIntegrations"
import { handleVerifySdkJobServer } from "./routes/sdkJobServer"
import { handleSdkListen } from "./routes/sdkListen"
import { handleSdkRunTriggerEvent } from "./routes/sdkRunTriggerEvent"
import { handleSessionEvents } from "./routes/sdkSession"
import { handleToolDefinitions } from "./routes/sdkToolDefinitions"
import { handleToolExecute } from "./routes/sdkToolExecute"
import { getSentNotifications } from "./routes/sentNotifications"
import { getCurrentSlackIntegration, getSlackChannels, getSlackIntegrations, getSlackUsers, slackOAuthCallback } from "./routes/slack"
import { createOrUpdateSnowflakeIntegration, getSnowflakeIntegrations } from "./routes/snowflake"
import { getStats } from "./routes/stats"
import { toolsThatRequireApprovalsRoute } from "./routes/tools"
import { getUserById } from "./routes/users"
import { handleWebhookTrigger } from "./routes/webhookTrigger"
import { handleWorkOSWebhook } from "./routes/workos"
import { createOrUpdateWorkOSIntegration, getWorkOSIntegrations, handleWorkOSTriggerWebhook, updateWorkOSWebhookSecret } from "./routes/workosIntegration"
import { registerSocketGetter } from "./services/CacheInvalidationService"
import { setupSlackBolt } from "./slack/boltApp"
import { analytics } from "./utility/analytics"
import { AuthKind, requireAuth } from "./utility/authMiddleware"
import { buildCorsAllowedOrigins, isCorsOriginAllowed } from "./utility/corsOrigins"
import { httpAccessLog } from "./utility/httpAccessLog"
import { workos } from "./utility/workos"

const app = express()
// On Render the app sits behind a single load-balancer hop. Without this,
// req.ip is the proxy's IP — every request would key against one "client"
// for rate-limit purposes and one abuser could lock out everyone. `1` means
// "trust exactly the last hop" (the Render LB); trusting more would let
// clients spoof X-Forwarded-For.
app.set("trust proxy", 1)

// HTTP access log: must be the first middleware so we capture every request,
// including ones rejected by CORS or by the body-parser size/syntax checks.
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

app.post(ApiRoutes.CLEANUP_SDK_IMAGES, requireAuth([AuthKind.CloudScheduler]), async (req, res) => {
    cleanupSdkImages(req, res)
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

// MARK: DEVICE AUTH (uses WorkOS JWT in body, not bearer token)
app.post(ApiRoutes.SDK.IDENTIFY, rateLimit(RateLimitKind.Identify), async (req, res) => {
    await identify(req, res)
})

app.post(ApiRoutes.SDK.DEVICE_TOKEN_EXCHANGE, rateLimit(RateLimitKind.TokenMinting), async (req, res) => {
    await deviceTokenExchange(req, res)
})

// Billing service callback: uses a service JWT, not bearer API token auth.
app.post(ApiRoutes.BILLING.CACHE_INVALIDATION, rateLimit(RateLimitKind.WebhookByIp), async (req, res) => {
    await invalidateBillingCachesFromService(req, res)
})

app.post(ApiRoutes.BILLING.CHECKOUT_SESSION, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { requireAdmin: true }), async (req, res) => {
    await createBillingCheckoutSession(req, res)
})

app.post(ApiRoutes.BILLING.CHANGE, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { requireAdmin: true }), async (req, res) => {
    await changeBillingSubscription(req, res)
})

app.post(ApiRoutes.BILLING.PORTAL_SESSION, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { requireAdmin: true }), async (req, res) => {
    await createBillingPortalSession(req, res)
})

app.get(ApiRoutes.BILLING.CONTEXT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { requireAdmin: true }), async (req, res) => {
    await getBillingContext(req, res)
})

app.get(ApiRoutes.BILLING.USAGE_BUCKETS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { requireAdmin: true }), async (req, res) => {
    await getBillingUsageBuckets(req, res)
})

app.get(ApiRoutes.BILLING.CATALOG, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { requireAdmin: true }), async (req, res) => {
    await getBillingCatalog(req, res)
})

app.get(ApiRoutes.BILLING.STATUS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { requireAdmin: true }), async (req, res) => {
    await getBillingStatus(req, res)
})

// MARK: AUTH

app.get(ApiRoutes.AUTH.ME, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { allowNoOrg: true }), me)

// GITHUB Will call this immediately after the user installs the app.
app.get(ApiRoutes.AUTH.GITHUB_APP_CALLBACK, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    githubAppCallbackIntegrate(req, res)
})

app.get(ApiRoutes.AUTH.LOGIN, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    login(req, res)
})

app.get(ApiRoutes.AUTH.LOGIN_URL, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    await loginUrl(req, res)
})

app.get(ApiRoutes.AUTH.LOGOUT, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    await logout(req, res)
})

app.get(ApiRoutes.AUTH.LOGOUT_URL, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    await logoutUrl(req, res)
})

app.get(ApiRoutes.AUTH.WORKOS_CALLBACK, rateLimit(RateLimitKind.AuthEndpoint), (req, res) => {
    callback(req, res)
})

app.get(ApiRoutes.WORKOS.WIDGET_TOKEN, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), (req, res) => getWorkOSWidgetToken(req, res))

// MARK: Organizations (WorkOS) - auth without org required so user can create org
app.post(ApiRoutes.ORGANIZATIONS.CREATE, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { allowNoOrg: true }), (req, res) => createOrganization(req, res))

app.get(ApiRoutes.ORGANIZATIONS.GET_CURRENT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { allowNoOrg: true }), (req, res) =>
    getCurrentOrganization(req, res)
)

app.get(ApiRoutes.ORGANIZATIONS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), (req, res) => getUserOrganizations(req, res))

app.post(ApiRoutes.ORGANIZATIONS.SWITCH, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), (req, res) => switchOrganization(req, res))

app.put(ApiRoutes.ORGANIZATIONS.UPDATE, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), (req, res) => updateOrganization(req, res))

app.get(ApiRoutes.ORGANIZATIONS.LOGO_UPLOAD_URL, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), (req, res) => getLogoUploadUrl(req, res))

app.get(ApiRoutes.ORGANIZATIONS.LOGO, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), (req, res) => getLogoUrl(req, res))

// MARK: STATS
app.get(ApiRoutes.STATS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getStats(req, res)
})

// MARK: RUN HISTORY

app.get(ApiRoutes.RUN_HISTORY.ACTIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getRunHistoryActions(req, res)
})

app.get(ApiRoutes.RUN_HISTORY.ALL, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getAllRunHistory(req, res)
})

app.get(ApiRoutes.RUN_HISTORY.BY_AGENT_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getRunHistory(req, res)
})

app.get(ApiRoutes.RUN_HISTORY.CHAT_BY_RUN_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getChatHistory(req, res)
})

// MARK: SESSION

app.get(ApiRoutes.SESSION.TOKEN, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    requestSessionSocketToken(req, res)
})

// MARK: USERS

app.get(ApiRoutes.USERS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getUserById(req, res)
})

// MARK: GITHUB APP

app.get(ApiRoutes.GITHUB.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getGithubIntegrations(req, res)
})

app.get(ApiRoutes.GITHUB.GET_REPOSITORIES_FOR_INTEGRATION, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getGithubRepositoriesForIntegration(req, res)
})

// MARK: GMAIL
app.get(ApiRoutes.GMAIL.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getGmailIntegrations(req, res)
})

app.get(ApiRoutes.GMAIL.CALLBACK, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    gmailCallback(req, res)
})

app.delete(ApiRoutes.GMAIL.DELETE_INTEGRATION, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    deleteGmailIntegration(req, res)
})

// MARK: NOTION

app.get(ApiRoutes.NOTION.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getNotionIntegrations(req, res)
})

// OAuth endpoints

app.get(ApiRoutes.NOTION.OAUTH_CALLBACK, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    notionOAuthCallback(req, res)
})

app.get(ApiRoutes.NOTION.RESOURCES, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getNotionResources(req, res)
})

// MARK: ATTIO

app.get(ApiRoutes.ATTIO.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getAttioIntegrations(req, res)
})

app.get(ApiRoutes.ATTIO.OAUTH_CALLBACK, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    attioOAuthCallback(req, res)
})

app.get(ApiRoutes.ATTIO.OBJECTS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getAttioObjects(req, res)
})

// MARK: LINEAR

app.get(ApiRoutes.LINEAR.OAUTH_CALLBACK, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    linearOAuthCallback(req, res)
})

app.get(ApiRoutes.LINEAR.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getLinearIntegrations(req, res)
})

app.get(ApiRoutes.LINEAR.TEAMS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getLinearTeams(req, res)
})

app.get(ApiRoutes.LINEAR.PROJECTS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getLinearProjects(req, res)
})

// Manual trigger endpoint (authenticated)
app.post(ApiRoutes.SCHEDULE.TRIGGER_BY_INPUT_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleManualTrigger(req, res)
})

// Trigger with a specific event payload (authenticated)
app.post(ApiRoutes.SCHEDULE.TRIGGER_WITH_EVENT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleTriggerWithEvent(req, res)
})

// MARK: SLACK

app.get(ApiRoutes.SLACK.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getSlackIntegrations(req, res)
})

app.get(ApiRoutes.SLACK.GET_CURRENT_INTEGRATION, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getCurrentSlackIntegration(req, res)
})

app.get(ApiRoutes.SLACK.OAUTH_CALLBACK, rateLimit(RateLimitKind.AuthEndpoint), async (req, res) => {
    slackOAuthCallback(req, res)
})

app.get(ApiRoutes.SLACK.CHANNELS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getSlackChannels(req, res)
})

app.get(ApiRoutes.SLACK.USERS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    await getSlackUsers(req, res)
})

// MARK: HEYREACH

app.get(ApiRoutes.HEY_REACH.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getHeyReachIntegrations(req, res)
})

app.post(ApiRoutes.HEY_REACH.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    createOrUpdateHeyReachIntegration(req, res)
})

app.get(ApiRoutes.HEY_REACH.CAMPAIGNS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getHeyReachCampaigns(req, res)
})

// MARK: POSTHOG

app.get(ApiRoutes.POSTHOG.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getPosthogIntegrations(req, res)
})

app.post(ApiRoutes.POSTHOG.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    createOrUpdatePosthogIntegration(req, res)
})

app.get(ApiRoutes.POSTHOG.PROJECTS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getPosthogProjects(req, res)
})

// MARK: LAUNCHDARKLY

app.get(ApiRoutes.LAUNCHDARKLY.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getLaunchDarklyIntegrations(req, res)
})

app.post(ApiRoutes.LAUNCHDARKLY.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    createOrUpdateLaunchDarklyIntegration(req, res)
})

app.get(ApiRoutes.LAUNCHDARKLY.PROJECTS_BY_INTEGRATION_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getLaunchDarklyProjects(req, res)
})

app.get(ApiRoutes.LAUNCHDARKLY.ENVIRONMENTS_BY_INTEGRATION_AND_PROJECT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getLaunchDarklyEnvironments(req, res)
})

// MARK: DATADOG

app.get(ApiRoutes.DATADOG.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getDatadogIntegrations(req, res)
})

app.post(ApiRoutes.DATADOG.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    createOrUpdateDatadogIntegration(req, res)
})

app.get(ApiRoutes.DATADOG.INDEXES, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getDatadogIndexes(req, res)
})

// MARK: SNOWFLAKE

app.get(ApiRoutes.SNOWFLAKE.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getSnowflakeIntegrations(req, res)
})

app.post(ApiRoutes.SNOWFLAKE.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    createOrUpdateSnowflakeIntegration(req, res)
})

// MARK: WORKOS INTEGRATION (customer's own WorkOS account)

app.get(ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getWorkOSIntegrations(req, res)
})

app.post(ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    createOrUpdateWorkOSIntegration(req, res)
})

app.patch(ApiRoutes.WORKOS_INTEGRATION.WEBHOOK_SECRET, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    updateWorkOSWebhookSecret(req, res)
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

// MARK: IMPROVEMENTS

app.get(ApiRoutes.IMPROVEMENTS.BY_AGENT_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getAgentImprovements(req, res)
})

app.post(ApiRoutes.IMPROVEMENTS.APPLY, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    applyImprovement(req, res)
})

app.post(ApiRoutes.IMPROVEMENTS.DISMISS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    dismissImprovement(req, res)
})

app.post(ApiRoutes.IMPROVEMENTS.UNDO_DISMISS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    undoDismissImprovement(req, res)
})

app.patch(ApiRoutes.IMPROVEMENTS.TOGGLE_ENABLED, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    toggleImprovementsEnabled(req, res)
})

// MARK: INTEGRATIONS

app.get(ApiRoutes.INTEGRATIONS.INSTALLATION_DETAILS_BY_TYPE, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getIntegrationInstallationDetails(req, res)
})

app.get("/integrations", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getAllIntegrations(req, res)
})

app.delete(ApiRoutes.INTEGRATIONS.DISCONNECT_BY_TYPE, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    disconnectIntegration(req, res)
})

app.get("/integrations/active", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getActiveIntegrations(req, res)
})

// MARK: NOTIFICATION DESTINATIONS

app.get(ApiRoutes.NOTIFICATION_DESTINATIONS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getNotificationDestinations(req, res)
})

app.post(ApiRoutes.NOTIFICATION_DESTINATIONS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    createNotificationDestination(req, res)
})

app.get(ApiRoutes.NOTIFICATION_SETTINGS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getNotificationSettings(req, res)
})

app.post(ApiRoutes.NOTIFICATION_SETTINGS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    updateNotificationSettings(req, res)
})

app.put(ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    updateNotificationDestination(req, res)
})

app.delete(ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    deleteNotificationDestination(req, res)
})

// MARK: API TOKENS

app.get(ApiRoutes.API_TOKENS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getApiTokens(req, res)
})

app.post(ApiRoutes.API_TOKENS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    createApiToken(req, res)
})

app.patch(ApiRoutes.API_TOKENS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    updateApiToken(req, res)
})

app.delete(ApiRoutes.API_TOKENS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    deleteApiToken(req, res)
})

// MARK: SDK

app.get(ApiRoutes.SDK.ME, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req: Request, res: Response) => {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    try {
        const workOSUser = await workos.userManagement.getUser(user.workosId)
        return res.json({
            id: user.id,
            email: workOSUser.email,
            firstName: workOSUser.firstName || null,
            lastName: workOSUser.lastName || null,
            displayName: [workOSUser.firstName, workOSUser.lastName].filter(Boolean).join(" ") || null,
            organizationId: user.organizationId,
            organization: user.organizationId ? { id: user.organizationId, name: user.organizationName } : null
        })
    } catch (error) {
        logger.error("[/sdk/me] Failed to fetch user from WorkOS", { error })
        return res.status(500).json({ error: "Failed to fetch user" })
    }
})

app.get(ApiRoutes.SDK.ME_ORGANIZATIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req, res) => {
    await listMyOrganizations(req, res)
})

app.post(ApiRoutes.SDK.SWITCH_ORGANIZATION, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserToken]), async (req, res) => {
    await sdkSwitchOrganization(req, res)
})

app.post(ApiRoutes.SDK.SAMPLE_EVENTS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleSampleEvents(req, res)
})

app.post(ApiRoutes.SDK.HYDRATE_SAMPLE_EVENT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleHydrateSampleEvent(req, res)
})

app.post(ApiRoutes.SDK.VERIFY_JOB_SERVER, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleVerifySdkJobServer(req, res)
})

app.post(ApiRoutes.SDK.TOOL_EXECUTE, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req, res) => {
    handleToolExecute(req, res)
})

app.get(ApiRoutes.SDK.TOOL_DEFINITIONS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req, res) => {
    handleToolDefinitions(req, res)
})

app.get(ApiRoutes.SDK.RUN_TRIGGER_EVENT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req, res) => {
    handleSdkRunTriggerEvent(req, res)
})

app.post(ApiRoutes.SDK.AGENT_RUN, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req, res) => {
    handleSdkAgentRun(req, res)
})

app.post(ApiRoutes.SDK.APPROVAL_DECISION, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req, res) => {
    handleSdkApprovalDecision(req, res)
})

app.get(ApiRoutes.SDK.SESSION_EVENTS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req, res) => {
    handleSessionEvents(req, res)
})

app.get(ApiRoutes.SDK.LISTEN, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), async (req, res) => {
    handleSdkListen(req, res)
})

app.post(ApiRoutes.SDK.DEPLOY, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleSdkDeploy(req, res)
})

app.get(ApiRoutes.SDK.INTEGRATION_FIELDS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleSdkIntegrationFields(req, res)
})

app.post(ApiRoutes.SDK.INTEGRATION_FORM_SUBMIT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleSdkIntegrationFormSubmit(req, res)
})

app.get(ApiRoutes.SENT_NOTIFICATIONS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getSentNotifications(req, res)
})

app.get(ApiRoutes.PENDING_APPROVALS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    getPendingApprovals(req, res)
})

app.post(ApiRoutes.SDK.CREATE_PROJECT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleProjectCreate(req, res)
})

app.get(ApiRoutes.PROJECTS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleListProjects(req, res)
})

app.get(ApiRoutes.PROJECTS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleGetProjectById(req, res)
})

app.delete(ApiRoutes.PROJECTS.BY_ID, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleProjectDelete(req, res)
})

app.get(ApiRoutes.PROJECTS.DEPLOYS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleGetProjectDeploys(req, res)
})

app.get(ApiRoutes.PROJECTS.SOURCE_FILES, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleGetProjectSourceFiles(req, res)
})

app.get(ApiRoutes.PROJECTS.SOURCE_FILE_CONTENT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleGetProjectSourceFileContent(req, res)
})

app.post(ApiRoutes.PROJECTS.ROTATE_SIGNING_SECRET, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleRotateProjectSigningSecret(req, res)
})

app.post(ApiRoutes.PROJECTS.ROTATE_API_KEY, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleRotateProjectApiKey(req, res)
})

app.get(ApiRoutes.PROJECT_SECRETS.LIST, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleListProjectSecrets(req, res)
})

app.post(ApiRoutes.PROJECT_SECRETS.UPSERT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleUpsertProjectSecret(req, res)
})

app.delete(ApiRoutes.PROJECT_SECRETS.DELETE, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleDeleteProjectSecret(req, res)
})

app.post(ApiRoutes.PROJECT_SECRETS.IMPORT, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    handleImportProjectSecrets(req, res)
})

// MARK: TOOLS THAT REQUIRE APPROVALS

app.post(ApiRoutes.TOOLS.THAT_REQUIRE_APPROVALS, rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), async (req, res) => {
    toolsThatRequireApprovalsRoute(req, res)
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

// Graceful shutdown.
// Render's default shutdown delay is 30s before SIGKILL. Aim to finish a few
// seconds under that so the force-exit branch can log before Render kills us.
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

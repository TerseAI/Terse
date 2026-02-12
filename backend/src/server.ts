import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import "dotenv/config"
import express, { NextFunction, Request, Response } from "express"
import { createServer } from "http"

import { setupLLMAnalytics } from "./agent/openaiInstance"
// Import settings early to validate environment variables at startup
import { requestSessionSocketToken } from "./agent/socket"
import "./config/settings"
import "./integrations/IntegrationTaskHandler"
// Import to trigger listener registration
import logger from "./logger"
import { getRealtimeSocket, initializeRealtimeSocket } from "./realtimeSocket"
import { createAgent, deleteAgent, getRecentAgents, getUserAgent, getUserAgents, updateAgent } from "./routes/agents"
import { authMiddleware, authMiddlewareAllowNoOrg, callback, getWorkOSWidgetToken, login, logout, me } from "./routes/auth"
import { githubAppCallbackIntegrate } from "./routes/auth/githubAuth"
import { getBuilderChatHistory } from "./routes/builderChat"
import { getConfluenceIntegrations, getConfluenceResources } from "./routes/confluence"
import { createOrUpdateDatadogIntegration, getDatadogIndexes, getDatadogIntegrations } from "./routes/datadog"
import { figmaOAuthCallback, getFigmaIntegrations, handleFigmaWebhook } from "./routes/figma"
import { getGithubIntegrations, getGithubRepositoriesForIntegration, getInstallationUrl, githubAppUnifiedEvent } from "./routes/github"
import { deleteGmailIntegration, getGmailIntegrations, gmailCallback, handleGmailWebhook } from "./routes/gmail"
import { getActiveIntegrations, getAllIntegrations, getIntegrationInstallationDetails } from "./routes/integrations"
import { atlassianOAuthCallback, getAtlassianIntegrations, getJiraResources, handleJiraWebhook } from "./routes/jira"
import { createOrUpdateLaunchDarklyIntegration, getLaunchDarklyEnvironments, getLaunchDarklyIntegrations, getLaunchDarklyProjects } from "./routes/launchdarkly"
import { getLinearIntegrations, getLinearTeams, handleLinearWebhook, linearOAuthCallback } from "./routes/linear"
import { createNotificationDestination, deleteNotificationDestination, getNotificationDestinations, updateNotificationDestination } from "./routes/notificationDestinations"
import { getNotionIntegrations, getNotionResources, notionOAuthCallback } from "./routes/notion"
import { createOrganization, getCurrentOrganization, getLogoUploadUrl, getLogoUrl, getUserOrganizations, switchOrganization, updateOrganization } from "./routes/organization"
import { createOrUpdatePosthogIntegration, getPosthogIntegrations, getPosthogProjects } from "./routes/posthog"
import { refreshAllTokens } from "./routes/refreshTokens"
import { getAllRunHistory, getChatHistory, getRunHistory, getRunHistoryActions } from "./routes/runHistory"
import { handleManualTrigger, handleScheduleWebhook } from "./routes/schedule"
import { getCurrentSlackIntegration, getSlackChannels, getSlackIntegrations, getSlackUsers, slackOAuthCallback } from "./routes/slack"
import { getStats } from "./routes/stats"
import { getPublicTemplates, getTemplates } from "./routes/templates"
import { toolsThatRequireApprovalsRoute } from "./routes/tools"
import { handleWorkOSWebhook } from "./routes/workos"
import { createOrUpdateWorkOSIntegration, getWorkOSIntegrations, handleWorkOSTriggerWebhook, updateWorkOSWebhookSecret } from "./routes/workosIntegration"
import { registerSocketGetter } from "./services/CacheInvalidationService"
import { ApiRoutes } from "./shared/ApiRoutes"
import { User } from "./shared/types"
import { setupSlackBolt } from "./slack/boltApp"
import { runStartupValidations } from "./tools/validateToolNames"
import { analytics } from "./utility/analytics"

export type Session = {
    user: User
    isUserInitiated: boolean
    teamId?: string
}

const app = express()
const server = createServer(app)

try {
    await initializeRealtimeSocket(server)
    registerSocketGetter(getRealtimeSocket)
    logger.info("✅ Socket.IO server initialized")
} catch (error) {
    logger.error("❌ Failed to initialize Socket.IO server", { error })
    process.exit(1)
}

// Initialize Slack Bolt app
const slackReceiver: Awaited<ReturnType<typeof setupSlackBolt>> | null = await setupSlackBolt()

// Initialize LLM analytics
setupLLMAnalytics()

app.use(
    cors({
        origin: true,
        credentials: true
    })
)

// Access logging middleware - only in production (too noisy for local dev)
// if (settings.nodeEnv !== "development") {
app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Capture request details
    const requestInfo = {
        requestId,
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        ip: req.ip || req.socket.remoteAddress || "unknown",
        userAgent: req.get("user-agent"),
        contentType: req.get("content-type"),
        contentLength: req.get("content-length") ? parseInt(req.get("content-length") || "0") : undefined,
        userId: (req.session?.user as User)?.id
    }

    // Log incoming request
    logger.info(`📥 ${req.method} ${req.path}`, requestInfo)

    // Capture response details
    const originalSend = res.send
    res.send = function (body: any) {
        const duration = Date.now() - startTime
        const responseInfo = {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            contentLength: res.get("content-length") ? parseInt(res.get("content-length") || "0") : undefined,
            userId: (req.session?.user as User)?.id
        }

        // Log response
        if (res.statusCode >= 400) {
            logger.warn(`📤 ${req.method} ${req.path} ${res.statusCode}`, responseInfo)
        } else {
            logger.info(`📤 ${req.method} ${req.path} ${res.statusCode}`, responseInfo)
        }

        return originalSend.call(this, body)
    }

    next()
})
// }

if (slackReceiver?.receiver) {
    app.use("/slack", slackReceiver.receiver.router)
    logger.info("✅ Slack Bolt router mounted at /slack")
}

// Routes that need larger body limits for webhooks with potentially large payloads
const LARGE_BODY_LIMIT_ROUTES: string[] = [ApiRoutes.GITHUB.UNIFIED_EVENT]
const LARGE_BODY_LIMIT = "10mb"
const DEFAULT_BODY_LIMIT = "1mb"

// Parse JSON for all routes except Slack events, Linear webhook, and WorkOS webhook (which need raw body for signature verification)
app.use((req, res, next) => {
    if (req.path === "/slack/events" || req.path === "/linear/webhook" || req.path === ApiRoutes.WEBHOOKS.WORKOS || req.path.startsWith("/webhooks/workos-trigger/")) {
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

// MARK: AUTH

app.get(ApiRoutes.AUTH.ME, authMiddlewareAllowNoOrg, me)

// GITHUB Will call this immediately after the user installs the app.
app.get(ApiRoutes.AUTH.GITHUB_APP_CALLBACK, async (req, res) => {
    githubAppCallbackIntegrate(req, res)
})

app.get(ApiRoutes.AUTH.LOGIN, async (req, res) => {
    login(req, res)
})

app.get(ApiRoutes.AUTH.LOGOUT, async (req, res) => {
    logout(req, res)
})

app.get(ApiRoutes.AUTH.WORKOS_CALLBACK, (req, res) => {
    callback(req, res)
})

app.get(ApiRoutes.WORKOS.WIDGET_TOKEN, authMiddleware, (req, res) => getWorkOSWidgetToken(req, res))

// MARK: Organizations (WorkOS) - auth without org required so user can create org
app.post(ApiRoutes.ORGANIZATIONS.CREATE, authMiddlewareAllowNoOrg, (req, res) => createOrganization(req, res))

app.get(ApiRoutes.ORGANIZATIONS.GET_CURRENT, authMiddlewareAllowNoOrg, (req, res) => getCurrentOrganization(req, res))

app.get(ApiRoutes.ORGANIZATIONS.LIST, authMiddleware, (req, res) => getUserOrganizations(req, res))

app.post(ApiRoutes.ORGANIZATIONS.SWITCH, authMiddleware, (req, res) => switchOrganization(req, res))

app.put(ApiRoutes.ORGANIZATIONS.UPDATE, authMiddleware, (req, res) => updateOrganization(req, res))

app.get(ApiRoutes.ORGANIZATIONS.LOGO_UPLOAD_URL, authMiddleware, (req, res) => getLogoUploadUrl(req, res))

app.get(ApiRoutes.ORGANIZATIONS.LOGO.pattern, authMiddleware, (req, res) => getLogoUrl(req, res))

// MARK: STATS
app.get(ApiRoutes.STATS, authMiddleware, async (req, res) => {
    getStats(req, res)
})

// MARK: RUN HISTORY

app.get(ApiRoutes.RUN_HISTORY.ACTIONS, authMiddleware, async (req, res) => {
    getRunHistoryActions(req, res)
})

app.get(ApiRoutes.RUN_HISTORY.ALL, authMiddleware, async (req, res) => {
    getAllRunHistory(req, res)
})

app.get(ApiRoutes.RUN_HISTORY.BY_AGENT_ID.pattern, authMiddleware, async (req, res) => {
    getRunHistory(req, res)
})

app.get(ApiRoutes.RUN_HISTORY.CHAT_BY_RUN_ID.pattern, authMiddleware, async (req, res) => {
    getChatHistory(req, res)
})

// MARK: BUILDER CHAT

app.get(ApiRoutes.BUILDER_CHAT.HISTORY_BY_SESSION_ID.pattern, authMiddleware, async (req, res) => {
    getBuilderChatHistory(req, res)
})

// MARK: SESSION

app.get(ApiRoutes.SESSION.TOKEN, authMiddleware, async (req, res) => {
    requestSessionSocketToken(req, res)
})

// MARK: GITHUB APP

app.get(ApiRoutes.GITHUB.INTEGRATIONS, authMiddleware, async (req, res) => {
    getGithubIntegrations(req, res)
})

app.get(ApiRoutes.GITHUB.INSTALLATION_URL, authMiddleware, async (req, res) => {
    getInstallationUrl(req, res)
})

app.get(ApiRoutes.GITHUB.GET_REPOSITORIES_FOR_INTEGRATION, authMiddleware, async (req, res) => {
    getGithubRepositoriesForIntegration(req, res)
})

app.post(ApiRoutes.GITHUB.UNIFIED_EVENT, async (req, res) => {
    await githubAppUnifiedEvent(req, res)
})

// MARK: JIRA

// MARK: ATLASSIAN
app.get(ApiRoutes.ATLASSIAN.INTEGRATIONS, authMiddleware, async (req, res) => {
    getAtlassianIntegrations(req, res)
})

app.get(ApiRoutes.JIRA.RESOURCES, authMiddleware, async (req, res) => {
    getJiraResources(req, res)
})

// OAuth endpoints
app.get(ApiRoutes.ATLASSIAN.OAUTH_CALLBACK, async (req, res) => {
    atlassianOAuthCallback(req, res)
})

// MARK: CONFLUENCE

app.get(ApiRoutes.CONFLUENCE.INTEGRATIONS, authMiddleware, async (req, res) => {
    getConfluenceIntegrations(req, res)
})

app.get(ApiRoutes.CONFLUENCE.RESOURCES, authMiddleware, async (req, res) => {
    getConfluenceResources(req, res)
})

// MARK: GMAIL
app.get(ApiRoutes.GMAIL.INTEGRATIONS, authMiddleware, async (req, res) => {
    getGmailIntegrations(req, res)
})

app.get(ApiRoutes.GMAIL.CALLBACK, async (req, res) => {
    gmailCallback(req, res)
})

app.delete(ApiRoutes.GMAIL.DELETE_INTEGRATION, authMiddleware, async (req, res) => {
    deleteGmailIntegration(req, res)
})

app.post(ApiRoutes.WEBHOOKS.GMAIL, async (req, res) => {
    handleGmailWebhook(req, res)
})
// MARK: REFRESH TOKENS

app.post(ApiRoutes.REFRESH_TOKENS, async (req, res) => {
    refreshAllTokens(req, res)
})

// MARK: NOTION

app.get(ApiRoutes.NOTION.INTEGRATIONS, authMiddleware, async (req, res) => {
    getNotionIntegrations(req, res)
})

// OAuth endpoints

app.get(ApiRoutes.NOTION.OAUTH_CALLBACK, async (req, res) => {
    notionOAuthCallback(req, res)
})

app.get(ApiRoutes.NOTION.RESOURCES, authMiddleware, async (req, res) => {
    getNotionResources(req, res)
})

// MARK: FIGMA

app.get(ApiRoutes.FIGMA.INTEGRATIONS, authMiddleware, async (req, res) => {
    getFigmaIntegrations(req, res)
})

app.get(ApiRoutes.FIGMA.OAUTH_CALLBACK, async (req, res) => {
    figmaOAuthCallback(req, res)
})

app.post(ApiRoutes.WEBHOOKS.FIGMA, async (req, res) => {
    handleFigmaWebhook(req, res)
})

// MARK: LINEAR

app.get(ApiRoutes.LINEAR.OAUTH_CALLBACK, async (req, res) => {
    linearOAuthCallback(req, res)
})

// Linear webhook needs raw body for signature verification
app.use(ApiRoutes.LINEAR.WEBHOOK, express.raw({ type: "application/json" }))

app.post(ApiRoutes.LINEAR.WEBHOOK, async (req, res) => {
    handleLinearWebhook(req, res)
})

// WorkOS webhook needs raw body for signature verification
app.use(ApiRoutes.WEBHOOKS.WORKOS, express.raw({ type: "application/json" }))

app.post(ApiRoutes.WEBHOOKS.WORKOS, async (req, res) => {
    handleWorkOSWebhook(req, res)
})

// WorkOS Trigger webhook needs raw body for signature verification
app.use(ApiRoutes.WEBHOOKS.WORKOS_TRIGGER_BY_INTEGRATION_ID.pattern, express.raw({ type: "application/json" }))

app.post(ApiRoutes.WEBHOOKS.WORKOS_TRIGGER_BY_INTEGRATION_ID.pattern, async (req, res) => {
    handleWorkOSTriggerWebhook(req, res)
})

app.get(ApiRoutes.LINEAR.INTEGRATIONS, authMiddleware, async (req, res) => {
    getLinearIntegrations(req, res)
})

app.get(ApiRoutes.LINEAR.TEAMS, authMiddleware, async (req, res) => {
    getLinearTeams(req, res)
})

app.post(ApiRoutes.WEBHOOKS.JIRA_BY_ACCOUNT_ID.pattern, async (req, res) => {
    // Use the new webhook handler which verifies authenticity and processes the event
    handleJiraWebhook(req, res)
})

// MARK: SCHEDULE (Cloud Scheduler)
app.post(ApiRoutes.WEBHOOKS.SCHEDULE_BY_INPUT_ID.pattern, async (req, res) => {
    handleScheduleWebhook(req, res)
})

// Manual trigger endpoint (authenticated)
app.post(ApiRoutes.SCHEDULE.TRIGGER_BY_INPUT_ID.pattern, authMiddleware, async (req, res) => {
    handleManualTrigger(req, res)
})

// MARK: SLACK

app.get(ApiRoutes.SLACK.INTEGRATIONS, authMiddleware, async (req, res) => {
    getSlackIntegrations(req, res)
})

app.get(ApiRoutes.SLACK.GET_CURRENT_INTEGRATION, authMiddleware, async (req, res) => {
    getCurrentSlackIntegration(req, res)
})

app.get(ApiRoutes.SLACK.OAUTH_CALLBACK, async (req, res) => {
    slackOAuthCallback(req, res)
})

app.get(ApiRoutes.SLACK.CHANNELS, authMiddleware, async (req, res) => {
    getSlackChannels(req, res)
})

app.get(ApiRoutes.SLACK.USERS, authMiddleware, async (req, res) => {
    await getSlackUsers(req, res)
})

// MARK: POSTHOG

app.get(ApiRoutes.POSTHOG.INTEGRATIONS, authMiddleware, async (req, res) => {
    getPosthogIntegrations(req, res)
})

app.post(ApiRoutes.POSTHOG.INTEGRATIONS, authMiddleware, async (req, res) => {
    createOrUpdatePosthogIntegration(req, res)
})

app.get(ApiRoutes.POSTHOG.PROJECTS, authMiddleware, async (req, res) => {
    getPosthogProjects(req, res)
})

// MARK: LAUNCHDARKLY

app.get(ApiRoutes.LAUNCHDARKLY.INTEGRATIONS, authMiddleware, async (req, res) => {
    getLaunchDarklyIntegrations(req, res)
})

app.post(ApiRoutes.LAUNCHDARKLY.INTEGRATIONS, authMiddleware, async (req, res) => {
    createOrUpdateLaunchDarklyIntegration(req, res)
})

app.get(ApiRoutes.LAUNCHDARKLY.PROJECTS_BY_INTEGRATION_ID.pattern, authMiddleware, async (req, res) => {
    getLaunchDarklyProjects(req, res)
})

app.get(ApiRoutes.LAUNCHDARKLY.ENVIRONMENTS_BY_INTEGRATION_AND_PROJECT.pattern, authMiddleware, async (req, res) => {
    getLaunchDarklyEnvironments(req, res)
})

// MARK: DATADOG

app.get(ApiRoutes.DATADOG.INTEGRATIONS, authMiddleware, async (req, res) => {
    getDatadogIntegrations(req, res)
})

app.post(ApiRoutes.DATADOG.INTEGRATIONS, authMiddleware, async (req, res) => {
    createOrUpdateDatadogIntegration(req, res)
})

app.get(ApiRoutes.DATADOG.INDEXES, authMiddleware, async (req, res) => {
    getDatadogIndexes(req, res)
})

// MARK: WORKOS INTEGRATION (customer's own WorkOS account)

app.get(ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS, authMiddleware, async (req, res) => {
    getWorkOSIntegrations(req, res)
})

app.post(ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS, authMiddleware, async (req, res) => {
    createOrUpdateWorkOSIntegration(req, res)
})

app.patch(ApiRoutes.WORKOS_INTEGRATION.WEBHOOK_SECRET, authMiddleware, async (req, res) => {
    updateWorkOSWebhookSecret(req, res)
})

// MARK: AGENTS

app.get("/agents", authMiddleware, async (req, res) => {
    getUserAgents(req, res)
})

app.get("/agents/recent", authMiddleware, async (req, res) => {
    getRecentAgents(req, res)
})

app.get(ApiRoutes.AGENTS.BY_ID.pattern, authMiddleware, async (req, res) => {
    getUserAgent(req, res)
})

app.post("/agents", authMiddleware, async (req, res) => {
    createAgent(req, res)
})

app.patch(ApiRoutes.AGENTS.BY_ID.pattern, authMiddleware, async (req, res) => {
    updateAgent(req, res)
})

app.delete(ApiRoutes.AGENTS.BY_ID.pattern, authMiddleware, async (req, res) => {
    deleteAgent(req, res)
})

// MARK: TEMPLATES

app.get(ApiRoutes.PUBLIC.TEMPLATES, async (req, res) => {
    getPublicTemplates(req, res)
})

app.get("/templates", authMiddleware, async (req, res) => {
    getTemplates(req, res)
})

// MARK: INTEGRATIONS

app.get(ApiRoutes.INTEGRATIONS.INSTALLATION_DETAILS_BY_TYPE.pattern, authMiddleware, async (req, res) => {
    getIntegrationInstallationDetails(req, res)
})

app.get("/integrations", authMiddleware, async (req, res) => {
    getAllIntegrations(req, res)
})

app.get("/integrations/active", authMiddleware, async (req, res) => {
    getActiveIntegrations(req, res)
})

// MARK: NOTIFICATION DESTINATIONS

app.get("/notification-destinations", authMiddleware, async (req, res) => {
    getNotificationDestinations(req, res)
})

app.post("/notification-destinations", authMiddleware, async (req, res) => {
    createNotificationDestination(req, res)
})

app.put(ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID.pattern, authMiddleware, async (req, res) => {
    updateNotificationDestination(req, res)
})

app.delete(ApiRoutes.NOTIFICATION_DESTINATIONS.BY_ID.pattern, authMiddleware, async (req, res) => {
    deleteNotificationDestination(req, res)
})

// MARK: TOOLS THAT REQUIRE APPROVALS

app.post(ApiRoutes.TOOLS.THAT_REQUIRE_APPROVALS, authMiddleware, async (req, res) => {
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

try {
    runStartupValidations()
} catch (error) {
    logger.error("❌ Startup validation failed", { error })
    process.exit(1)
}

server.listen(3001, () => {
    logger.info("🚀 Express backend running on http://localhost:3001")
})

// Graceful shutdown
process.on("SIGTERM", async () => {
    await analytics.shutdown()
    server.close()
})

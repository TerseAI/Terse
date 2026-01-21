import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
// Import settings early to validate environment variables at startup
import "./config/settings";
import { settings } from "./config/settings";
import { requestSessionSocketToken } from "./agent/socket";
import { getActivityFeed, getDailyActivitySummary } from "./routes/activity";
import { authMiddleware, login, logout, setSession } from "./routes/auth";
import {
  githubAppAuthMiddleware,
  githubAppCallbackIntegrate,
  githubAppOAuth,
  githubCallback,
  githubLoginURL,
} from "./routes/auth/githubAuth";
import {
  googleCallback,
  googleLogin,
  googleLoginURL,
} from "./routes/auth/googleAuth";
import {
  createChannel,
  deleteChannel,
  getRecentChannels,
  getUserChannel,
  getUserChannels,
  updateChannel,
} from "./routes/channels";
import {
  getInstallationUrl,
  githubAppUnifiedEvent,
  githubAppInstallationDeleted,
  processsGithubAppInstallationWebhook,
  getGithubRepositoriesForIntegration,
  getGithubIntegrations,
} from "./routes/github";
import {
  deleteGmailIntegration,
  getGmailIntegrations,
  gmailCallback,
  handleGmailWebhook
} from "./routes/gmail";
import { refreshAllTokens } from "./routes/refreshTokens";
import {
  getAtlassianIntegrations,
  atlassianOAuthCallback,
  handleJiraWebhook,
  getJiraResources,
} from "./routes/jira";
import {
  linearOAuthCallback,
  getLinearIntegrations,
  getLinearTeams,
  handleLinearWebhook,
} from "./routes/linear";
import {
  notionOAuthCallback,
  getNotionResources,
  getNotionIntegrations
} from "./routes/notion";
import { getRunHistory, getChatHistory, getRunHistoryActions } from "./routes/runHistory";
import { getStats } from "./routes/stats";
import { User as TicketUser } from "./shared/TicketSystem";
import {
  getCurrentSlackIntegration,
  slackOAuthCallback,
  getSlackChannels,
  getSlackIntegrations,
  getSlackUsers,
} from "./routes/slack";
import { TicketManager } from "./ticketing/TicketIntegration";
import { User } from "./types/prisma";
import {
  figmaOAuthCallback,
  getFigmaIntegrations,
  handleFigmaWebhook,
} from "./routes/figma";
import { getConfluenceIntegrations, getConfluenceResources } from "./routes/confluence";
import { getActiveIntegrations, getAllIntegrations, getIntegrationInstallationDetails } from "./routes/integrations";
import { initializeRealtimeSocket } from "./realtimeSocket";
import { generateQuestionsRoute, generatePromptRoute } from "./routes/promptBuilder";
import {
  createNotificationDestination,
  deleteNotificationDestination,
  getNotificationDestinations,
  updateNotificationDestination,
} from "./routes/notificationDestinations";
import { setupSlackBolt } from "./slack/boltApp";
import logger from "./logger";
import { getPosthogIntegrations, createOrUpdatePosthogIntegration, getPosthogProjects } from "./routes/posthog";
import { getLaunchDarklyIntegrations, createOrUpdateLaunchDarklyIntegration, getLaunchDarklyProjects, getLaunchDarklyEnvironments } from "./routes/launchdarkly";
import { getDatadogIntegrations, createOrUpdateDatadogIntegration, getDatadogIndexes } from "./routes/datadog";
import { handleScheduleWebhook, handleManualTrigger } from "./routes/schedule";
import { getTemplates } from "./routes/templates";
import "./integrations/IntegrationTaskHandler"; // Import to trigger listener registration

export type Session = {
  user: User;
  ticketManager?: TicketManager;
  isUserInitiated: boolean; // true if the user has initiated the session, false if the session was initiated by the system
  teamId?: string;
  currentUser?: TicketUser;
};

const app = express();
const server = createServer(app);

try {
  await initializeRealtimeSocket(server);
  logger.info("✅ Socket.IO server initialized");
} catch (error) {
  logger.error("❌ Failed to initialize Socket.IO server", { error });
  process.exit(1);
}

// Initialize Slack Bolt app
const slackReceiver: Awaited<ReturnType<typeof setupSlackBolt>> | null = await setupSlackBolt();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Access logging middleware - comprehensive request/response logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Capture request details
  const requestInfo = {
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    contentLength: req.get('content-length') ? parseInt(req.get('content-length') || '0') : undefined,
    userId: (req.session?.user as User)?.id,
  };

  // Log incoming request
  logger.info(`📥 ${req.method} ${req.path}`, requestInfo);

  // Capture response details
  const originalSend = res.send;
  res.send = function (body: any) {
    const duration = Date.now() - startTime;
    const responseInfo = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length') ? parseInt(res.get('content-length') || '0') : undefined,
      userId: (req.session?.user as User)?.id,
    };

    // Log response
    if (res.statusCode >= 400) {
      logger.warn(`📤 ${req.method} ${req.path} ${res.statusCode}`, responseInfo);
    } else {
      logger.info(`📤 ${req.method} ${req.path} ${res.statusCode}`, responseInfo);
    }

    return originalSend.call(this, body);
  };

  next();
});


if (slackReceiver?.receiver) {
  app.use("/slack", slackReceiver.receiver.router);
  logger.info("✅ Slack Bolt router mounted at /slack");
}

// Parse JSON for all routes except Slack events and Linear webhook (which need raw body for signature verification)
app.use((req, res, next) => {
  if (req.path === "/slack/events" || req.path === "/linear/webhook") {
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});
app.use(cookieParser());

// MARK: AUTH

app.get("/me", authMiddleware, (req, res) => {
  res.send(req.session?.user);
});

app.get("/auth/github-app", async (req, res) => {
  githubAppOAuth(req, res);
});

app.get("/auth/google", async (req, res) => {
  googleLogin(req, res);
});

app.post("/auth/set-session", async (req, res) => {
  setSession(req, res);
});

app.get("/auth/github-login/callback", async (req, res) => {
  githubCallback(req, res);
});

// GITHUB Will call this immediately after the user installs the app.
app.get("/auth/github-app/callback", async (req, res) => {
  githubAppCallbackIntegrate(req, res);
});

app.get("/auth/google/callback", async (req, res) => {
  googleCallback(req, res);
});

app.get("/auth/github/login-url", (req, res) => {
  githubLoginURL(req, res);
});

app.get("/auth/google/login-url", (req, res) => {
  googleLoginURL(req, res);
});

app.post("/login", async (req, res) => {
  login(req, res);
});

app.post("/logout", async (req, res) => {
  logout(req, res);
});

// MARK ACTIVITY FEED

app.get("/activity-feed", authMiddleware, async (req, res) => {
  getActivityFeed(req, res);
});

// Add daily summary route
app.get("/activity/daily-summary", authMiddleware, async (req, res) => {
  getDailyActivitySummary(req, res);
});

// MARK: STATS
app.get("/stats", authMiddleware, async (req, res) => {
  getStats(req, res);
});

// MARK: RUN HISTORY

app.get("/run-history/actions", authMiddleware, async (req, res) => {
  getRunHistoryActions(req, res);
});

app.get("/run-history/:channelId", authMiddleware, async (req, res) => {
  getRunHistory(req, res);
});

app.get("/run-history/:runId/chat", authMiddleware, async (req, res) => {
  getChatHistory(req, res);
});

// MARK: SESSION

app.get("/session/token", authMiddleware, async (req, res) => {
  requestSessionSocketToken(req, res);
});

// MARK: GITHUB APP

app.get("/github/integrations", authMiddleware, async (req, res) => {
  getGithubIntegrations(req, res);
})

app.get("/github/installation-url", authMiddleware, async (req, res) => {
  getInstallationUrl(req, res);
});

app.get("/github/get-repositories-for-integration", authMiddleware, async (req, res) => {
  getGithubRepositoriesForIntegration(req, res);
});

// THIS IS FOR THE PROBOT APP!
app.post(
  "/github/installation-callback",
  githubAppAuthMiddleware,
  async (req, res) => {
    processsGithubAppInstallationWebhook(req, res);
  }
);

app.post(
  "/github/installation-deleted",
  githubAppAuthMiddleware,
  async (req, res) => {
    githubAppInstallationDeleted(req, res);
  }
);

app.post("/github/unified-event", async (req, res) => {
  await githubAppUnifiedEvent(req, res);
});

// MARK: JIRA

// MARK: ATLASSIAN
app.get("/atlassian/integrations", authMiddleware, async (req, res) => {
  getAtlassianIntegrations(req, res);
});

app.get("/jira/resources", authMiddleware, async (req, res) => {
  getJiraResources(req, res);
});

// OAuth endpoints
app.get("/atlassian/oauth/callback", async (req, res) => {
  atlassianOAuthCallback(req, res);
});

// MARK: CONFLUENCE

app.get("/confluence/integrations", authMiddleware, async (req, res) => {
  getConfluenceIntegrations(req, res);
});

app.get("/confluence/resources", authMiddleware, async (req, res) => {
  getConfluenceResources(req, res);
});

// MARK: GMAIL
app.get("/gmail/integrations", authMiddleware, async (req, res) => {
  getGmailIntegrations(req, res);
});

app.get("/gmail/callback", async (req, res) => {
  gmailCallback(req, res);
});

app.delete("/gmail/delete-integration", authMiddleware, async (req, res) => {
  deleteGmailIntegration(req, res);
});

app.post("/webhooks/gmail", async (req, res) => {
  handleGmailWebhook(req, res);
});
// MARK: REFRESH TOKENS

app.post("/refresh-tokens", async (req, res) => {
  refreshAllTokens(req, res);
});

// MARK: NOTION

app.get("/notion/integrations", authMiddleware, async (req, res) => {
  getNotionIntegrations(req, res);
})

// OAuth endpoints

app.get("/notion/oauth/callback", async (req, res) => {
  notionOAuthCallback(req, res);
});

app.get("/notion/resources", authMiddleware, async (req, res) => {
  getNotionResources(req, res);
});

// MARK: FIGMA

app.get("/figma/integrations", authMiddleware, async (req, res) => {
  getFigmaIntegrations(req, res);
})

app.get("/figma/oauth/callback", async (req, res) => {
  figmaOAuthCallback(req, res);
});

app.post("/webhooks/figma", async (req, res) => {
  handleFigmaWebhook(req, res);
});

// MARK: LINEAR

app.get("/linear/oauth/callback", async (req, res) => {
  linearOAuthCallback(req, res);
});

// Linear webhook needs raw body for signature verification
app.use("/linear/webhook", express.raw({ type: "application/json" }));

app.post("/linear/webhook", async (req, res) => {
  handleLinearWebhook(req, res);
});

app.get("/linear/integrations", authMiddleware, async (req, res) => {
  getLinearIntegrations(req, res);
});

app.get("/linear/teams", authMiddleware, async (req, res) => {
  getLinearTeams(req, res);
});

app.post("/webhooks/jira/:accountId", async (req, res) => {
  // Use the new webhook handler which verifies authenticity and processes the event
  handleJiraWebhook(req, res);
});

// MARK: SCHEDULE (Cloud Scheduler)
app.post("/webhooks/schedule/:inputId", async (req, res) => {
  handleScheduleWebhook(req, res);
});

// Manual trigger endpoint (authenticated)
app.post("/schedule/trigger/:inputId", authMiddleware, async (req, res) => {
  handleManualTrigger(req, res);
});

// MARK: SLACK

app.get("/slack/integrations", authMiddleware, async (req, res) => {
  getSlackIntegrations(req, res);
})

app.get("/slack/get-current-integration", authMiddleware, async (req, res) => {
  getCurrentSlackIntegration(req, res);
});

app.get("/slack/oauth-callback", async (req, res) => {
  slackOAuthCallback(req, res);
});

app.get("/slack/channels", authMiddleware, async (req, res) => {
  getSlackChannels(req, res);
});

app.get("/slack/users", authMiddleware, async (req, res) => {
  getSlackUsers(req, res);
});

// MARK: POSTHOG

app.get("/posthog/integrations", authMiddleware, async (req, res) => {
  getPosthogIntegrations(req, res);
});

app.post("/posthog/integrations", authMiddleware, async (req, res) => {
  createOrUpdatePosthogIntegration(req, res);
});

app.get("/posthog/projects", authMiddleware, async (req, res) => {
  getPosthogProjects(req, res);
});

// MARK: LAUNCHDARKLY

app.get("/launchdarkly/integrations", authMiddleware, async (req, res) => {
  getLaunchDarklyIntegrations(req, res);
});

app.post("/launchdarkly/integrations", authMiddleware, async (req, res) => {
  createOrUpdateLaunchDarklyIntegration(req, res);
});

app.get("/launchdarkly/integrations/:integrationId/projects", authMiddleware, async (req, res) => {
  getLaunchDarklyProjects(req, res);
});

app.get("/launchdarkly/integrations/:integrationId/projects/:projectKey/environments", authMiddleware, async (req, res) => {
  getLaunchDarklyEnvironments(req, res);
});

// MARK: DATADOG

app.get("/datadog/integrations", authMiddleware, async (req, res) => {
  getDatadogIntegrations(req, res);
});

app.post("/datadog/integrations", authMiddleware, async (req, res) => {
  createOrUpdateDatadogIntegration(req, res);
});

app.get("/datadog/indexes", authMiddleware, async (req, res) => {
  getDatadogIndexes(req, res);
});

// MARK: CHANNELS

app.get("/channels", authMiddleware, async (req, res) => {
  getUserChannels(req, res);
});

app.get("/channels/recent", authMiddleware, async (req, res) => {
  getRecentChannels(req, res);
});

app.get("/channels/:id", authMiddleware, async (req, res) => {
  getUserChannel(req, res);
});

app.post("/channels", authMiddleware, async (req, res) => {
  createChannel(req, res);
});

app.patch("/channels/:id", authMiddleware, async (req, res) => {
  updateChannel(req, res);
});

app.delete("/channels/:id", authMiddleware, async (req, res) => {
  deleteChannel(req, res);
});

// MARK: TEMPLATES

app.get("/templates", authMiddleware, async (req, res) => {
  getTemplates(req, res);
});

// MARK: PROMPT BUILDER

app.post("/prompt-builder/generate-questions", authMiddleware, async (req, res) => {
  generateQuestionsRoute(req, res);
});

app.post("/prompt-builder/generate-prompt", authMiddleware, async (req, res) => {
  generatePromptRoute(req, res);
});

// MARK: INTEGRATIONS

app.get("/integrations/:integrationType/installation-details", authMiddleware, async (req, res) => {
  getIntegrationInstallationDetails(req, res);
});

app.get("/integrations", authMiddleware, async (req, res) => {
  getAllIntegrations(req, res);
});

app.get("/integrations/active", authMiddleware, async (req, res) => {
  getActiveIntegrations(req, res);
});

// MARK: NOTIFICATION DESTINATIONS

app.get("/notification-destinations", authMiddleware, async (req, res) => {
  getNotificationDestinations(req, res);
});

app.post("/notification-destinations", authMiddleware, async (req, res) => {
  createNotificationDestination(req, res);
});

app.put("/notification-destinations/:id", authMiddleware, async (req, res) => {
  updateNotificationDestination(req, res);
});

app.delete("/notification-destinations/:id", authMiddleware, async (req, res) => {
  deleteNotificationDestination(req, res);
});

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
  });
  res.status(500).json({
    error: "Internal server error"
  });
});

// Global unhandled rejection handler - safety net for fire-and-forget promises
// This catches any promises that reject without a .catch() handler
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  logger.error("❌ Unhandled Promise Rejection (safety net)", {
    error: errorMessage,
    stack
  });
  // Log but don't crash - this is a safety net for promises we might have missed
});

server.listen(3001, () => {
  logger.info("🚀 Express backend running on http://localhost:3001");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  server.close();
});

import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
// Import settings early to validate environment variables at startup
import "./config/settings";
import { requestSessionSocketToken } from "./agent/socket";
import { getActivityFeed, getDailyActivitySummary } from "./routes/activity";
import { authMiddleware, login, logout, setSession } from "./routes/auth";
import {
  githubAppAuthMiddleware,
  githubCallback,
  githubLogin,
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
  processSetUpURLGithubInstallation,
  processsGithubAppInstallationWebhook,
  getGithubRepositoriesForIntegration,
  getGithubIntegrations,
} from "./routes/github";
import {
  deleteGmailIntegration,
  getGmailIntegrations,
  gmailCallback,
  handleGmailWebhook,
  refreshAllGmailWatches,
} from "./routes/gmail";
import {
  deleteJiraCredentials,
  getJiraCredentials,
  getAtlassianIntegrations,
  indexJiraTicket,
  setJiraCredentials,
  validateJiraCredentials,
} from "./routes/jira";
import {
  linearOAuthCallback,
  getLinearIntegrations,
  handleLinearWebhook,
} from "./routes/linear";
import {
  notionOAuthCallback,
  getNotionResources,
  getNotionIntegrations
} from "./routes/notion";
import { getRunHistory } from "./routes/runHistory";
import { getStats } from "./routes/stats";
import { User as TicketUser } from "./shared/TicketSystem";
import {
  handleSlackWebhook,
  getCurrentSlackIntegration,
  slackOAuthCallback,
  getSlackChannels,
  getSlackIntegrations,
} from "./routes/slack";
import { TicketManager } from "./ticketing/TicketIntegration";
import { User } from "./types/prisma";
import { JiraWebhookPayload } from "./utility/JiraWebhookPayload";
import { LinearWebhookPayload } from "./utility/LinearWebhookPayload";
import {
  figmaOAuthCallback,
  getFigmaIntegrations,
  handleFigmaWebhook,
} from "./routes/figma";
import { getConfluenceIntegrations, getConfluenceResources, setConfluenceCredentials, validateConfluenceCredentials } from "./routes/confluence";
import { getActiveIntegrations, getIntegrationInstallationDetails } from "./routes/integrations";
import { initializeRealtimeSocket } from "./realtimeSocket";
import { RunHistoryAction } from "./shared/RunHistoryTypes";

export type Session = {
  user: User;
  ticketManager?: TicketManager;
  isUserInitiated: boolean; // true if the user has initiated the session, false if the session was initiated by the system
  teamId?: string;
  currentUser?: TicketUser;
  runActions?: RunHistoryAction[];
};

const app = express();
const server = createServer(app);

try {
  await initializeRealtimeSocket(server);
  console.log("✅ Socket.IO server initialized");
} catch (error) {
  console.error("❌ Failed to initialize Socket.IO server:", error);
  process.exit(1);
}

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Request logging middleware - logs ALL incoming requests
app.use((req, res, next) => {
  console.log(`📥 [REQUEST] ${req.method} ${req.path}`);
  console.log(`📥 [REQUEST] Headers present: ${Object.keys(req.headers).length} headers`);
  next();
});

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

app.get("/auth/github", async (req, res) => {
  githubLogin(req, res);
});

app.get("/auth/google", async (req, res) => {
  googleLogin(req, res);
});

app.post("/auth/set-session", async (req, res) => {
  setSession(req, res);
});

app.get("/auth/github/callback", async (req, res) => {
  githubCallback(req, res);
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

app.get("/run-history/:channelId", authMiddleware, async (req, res) => {
  getRunHistory(req, res);
});

// MARK: SESSION

app.get("/session/token", authMiddleware, async (req, res) => {
  requestSessionSocketToken(req, res);
});

// MARK: GITHUB APP

app.get("/github/integrations", authMiddleware, async(req, res) => {
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

// GITHUB Will call this directly to the backend, not through the Probot app.
app.get("/github/frontend-installation-callback", async (req, res) => {
  processSetUpURLGithubInstallation(req, res);
});

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

app.post("/jira/set-api-key", authMiddleware, async (req, res) => {
  setJiraCredentials(req, res);
});

app.post("/jira/validate-and-fetch-projects", authMiddleware, async (req, res) => {
  validateJiraCredentials(req, res);
});

app.get("/jira/get-api-key", authMiddleware, async (req, res) => {
  getJiraCredentials(req, res);
});

app.delete("/jira/delete-credentials", authMiddleware, async (req, res) => {
  deleteJiraCredentials(req, res);
});

// MARK: ATLASSIAN
app.get("/atlassian/integrations", authMiddleware, async (req, res) => {
  getAtlassianIntegrations(req, res);
});

// MARK: CONFLUENCE

app.get("/confluence/integrations", authMiddleware, async(req, res) => {
  getConfluenceIntegrations(req, res);
})

app.post("/confluence/set-api-key", authMiddleware, async (req, res) => {
  setConfluenceCredentials(req, res);
});

app.post("/confluence/validate-credentials", authMiddleware, async (req, res) => {
  validateConfluenceCredentials(req, res);
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

app.post("/gmail/refresh-watches", async (req, res) => {
  refreshAllGmailWatches(req, res);
});

// MARK: NOTION

app.get("/notion/integrations", authMiddleware, async(req, res) => {
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

app.get("/figma/integrations", authMiddleware, async(req, res) => {
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

app.post("/webhooks/jira/:userId", async (req, res) => {
  const { userId } = req.params;
  const event: JiraWebhookPayload = req.body;

  console.log("Jira webhook event received:", event.webhookEvent);

  // Update your search index based on the event
  if (event.webhookEvent.startsWith("jira:issue_")) {
    await indexJiraTicket(userId, event);
  } else if (event.webhookEvent.includes("comment_")) {
    console.log("Jira Comment event", event.webhookEvent);
    // Could also index comments if needed
  } else {
    console.log("Other Jira event", event.webhookEvent);
  }

  res.json({ received: true });
});

// MARK: SLACK

app.get("/slack/integrations", authMiddleware, async(req, res) => {
  getSlackIntegrations(req, res);
})

app.get("/slack/get-current-integration", authMiddleware, async (req, res) => {
  getCurrentSlackIntegration(req, res);
});

app.get("/slack/oauth-callback", async (req, res) => {
  slackOAuthCallback(req, res);
});

app.use("/slack/events", express.raw({ type: "application/json" }));

app.post("/slack/events", async (req, res) => {
  await handleSlackWebhook(req, res);
});

app.get("/slack/channels", authMiddleware, async (req, res) => {
  getSlackChannels(req, res);
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

// MARK: INTEGRATIONS

app.get("/integrations/:integrationType/installation-details", authMiddleware, async (req, res) => {
  getIntegrationInstallationDetails(req, res);
});

app.get("/integrations/active", authMiddleware, async (req, res) => {
  getActiveIntegrations(req, res);
});

server.listen(3001, () => {
  console.log("🚀 Express backend running on http://localhost:3001");
  console.log("📝 Logging is enabled - all console.log statements should appear");
  console.log("📝 Testing log output...");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  server.close();
});

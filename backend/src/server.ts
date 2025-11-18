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
  createAutomation,
  deleteAutomation,
  getUserAutomation,
  getUserAutomations,
  updateAutomation,
} from "./routes/automations";
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
  getGmailOAuthUrl,
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
  deleteLinearCredentials,
  getLinearApiKey,
  indexLinearTicket,
  setLinearApiKey,
  validateLinearApiKey,
} from "./routes/linear";
import {
  getNotionOAuthUrl,
  notionOAuthCallback,
  getNotionResources,
  getNotionIntegrations
} from "./routes/notion";
import { getRunHistory } from "./routes/runHistory";
import { User as TicketUser } from "./shared/TicketSystem";
import {
  handleSlackWebhook,
  getCurrentSlackIntegration,
  getSlackOAuthUrl,
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
  getFigmaOAuthUrl,
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

// Parse JSON for all routes except Slack events (which needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.path === "/slack/events") {
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

// MARK: RUN HISTORY

app.get("/run-history/:automationId", authMiddleware, async (req, res) => {
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

app.get("/gmail/get-oauth-url", authMiddleware, async (req, res) => {
  getGmailOAuthUrl(req, res);
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
app.get("/notion/get-oauth-url", authMiddleware, async (req, res) => {
  getNotionOAuthUrl(req, res);
});

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

app.get("/figma/get-oauth-url", authMiddleware, async (req, res) => {
  getFigmaOAuthUrl(req, res);
});

app.get("/figma/oauth/callback", async (req, res) => {
  figmaOAuthCallback(req, res);
});

app.post("/webhooks/figma", async (req, res) => {
  handleFigmaWebhook(req, res);
});

// MARK: LINEAR

app.post("/linear/set-api-key", authMiddleware, async (req, res) => {
  setLinearApiKey(req, res);
});

app.post("/linear/validate-and-fetch-teams", authMiddleware, async (req, res) => {
  validateLinearApiKey(req, res);
});

app.get("/linear/get-api-key", authMiddleware, async (req, res) => {
  getLinearApiKey(req, res);
});

app.delete("/linear/delete-credentials", authMiddleware, async (req, res) => {
  deleteLinearCredentials(req, res);
});

app.post("/webhooks/linear/:userId", async (req, res) => {
  const { userId } = req.params;
  const event: LinearWebhookPayload = req.body;

  // Update your search index based on the event
  switch (event.type) {
    case "Issue":
      await indexLinearTicket(userId, event);
      break;
    case "Comment":
      console.log("Comment", event);
      break;
    case "Project":
      console.log("Project", event);
      break;
  }

  res.json({ received: true });
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

app.get("/slack/get-oauth-url", authMiddleware, async (req, res) => {
  getSlackOAuthUrl(req, res);
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

// MARK: AUTOMATIONS

app.get("/automations", authMiddleware, async (req, res) => {
  getUserAutomations(req, res);
});

app.get("/automations/:id", authMiddleware, async (req, res) => {
  getUserAutomation(req, res);
});

app.post("/automations", authMiddleware, async (req, res) => {
  createAutomation(req, res);
});

app.patch("/automations/:id", authMiddleware, async (req, res) => {
  updateAutomation(req, res);
});

app.delete("/automations/:id", authMiddleware, async (req, res) => {
  deleteAutomation(req, res);
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

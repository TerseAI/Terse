import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { createServer } from "http";
import cors from 'cors';
import { User } from './types/prisma';
import { User as TicketUser } from './shared/TicketSystem';
import { authMiddleware, githubAppAuthMiddleware, githubCallback, githubLogin, githubLoginURL, login, logout, setSession } from './routes/auth';
import { AgentSocketServer, requestSessionSocketToken } from './agent/socket';
import { getCurrentGithubIntegration, getInstallationUrl, githubAppInstallationCallback, githubAppInstallationDeleted, githubAppRecievedPush } from './routes/githubApp';
import { deleteLinearCredentials, getLinearApiKey, indexLinearTicket, setLinearApiKey } from './routes/linear';
import { deleteJiraCredentials, getJiraCredentials, setJiraCredentials } from './routes/jira';
import { TicketManager } from './ticketing/TicketIntegration';
import { LinearWebhookPayload } from './utility/LinearWebhookPayload';
import { getCurrentSlackIntegration, getSlackOAuthUrl, slackOAuthCallback } from './slack/registerApp';
import { handleSlackEvent } from './slack/eventHandler';
import { db } from './prismaClient';

export type Session = {
    user: User;
    ticketManager?: TicketManager;
    isUserInitiated: boolean; // true if the user has initiated the session, false if the session was initiated by the system
    teamId?: string;
    currentUser?: TicketUser;
}

const app = express();
const server = createServer(app);

// WebSocket handler, keep in memory as long as the server is running!!
const agentSocketServer = new AgentSocketServer(server, "/session");

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser());

// MARK: AUTH

app.get('/me', authMiddleware, (req, res) => {
    res.send(req.session?.user);
})

app.get('/auth/github', async (req, res) => {
    githubLogin(req, res);
})

app.post('/auth/set-session', async (req, res) => {
    setSession(req, res);
})

app.get('/auth/github/callback', async (req, res) => {
    githubCallback(req, res);
})

app.get('/auth/github/login-url', (req, res) => {
    githubLoginURL(req, res);
})

app.post('/login', async (req, res) => {
    login(req, res);
})

app.post('/logout', async (req, res) => {
    logout(req, res);
})

// MARK: SESSION

app.get('/session/token', authMiddleware, async (req, res) => {
    requestSessionSocketToken(req, res);
});

// MARK: GITHUB APP

app.get('/github/get-current-integration', authMiddleware, async (req, res) => {
    getCurrentGithubIntegration(req, res);
})

app.get('/github/installation-url', authMiddleware, async (req, res) => {
    getInstallationUrl(req, res);
})

app.post('/github/installation-callback', githubAppAuthMiddleware, async (req, res) => {
    githubAppInstallationCallback(req, res);
})

app.post('/github/installation-deleted', githubAppAuthMiddleware, async (req, res) => {
    githubAppInstallationDeleted(req, res);
})

app.post('/github/push-event', githubAppAuthMiddleware, async (req, res) => {
    githubAppRecievedPush(req, res);
})

// MARK: JIRA

app.post('/jira/set-api-key', authMiddleware, async (req, res) => {
    setJiraCredentials(req, res);
})

app.get('/jira/get-api-key', authMiddleware, async (req, res) => {
    getJiraCredentials(req, res);
})

app.delete('/jira/delete-credentials', authMiddleware, async (req, res) => {
    deleteJiraCredentials(req, res);
})

// MARK: LINEAR

app.post('/linear/set-api-key', authMiddleware, async (req, res) => {
    setLinearApiKey(req, res);
})

app.get('/linear/get-api-key', authMiddleware, async (req, res) => {
    getLinearApiKey(req, res);
})

app.delete('/linear/delete-credentials', authMiddleware, async (req, res) => {
    deleteLinearCredentials(req, res);
})

app.post('/webhooks/linear/:userId', async (req, res) => {
    const { userId } = req.params;
    const event: LinearWebhookPayload = req.body;

    // Update your search index based on the event
    switch (event.type) {
        case 'Issue':
            await indexLinearTicket(userId, event);
            break;
        case 'Comment':
            console.log("Comment", event);
            break;
        case 'Project':
            console.log("Project", event);
            break;
    }

    res.json({ received: true });
});

// MARK: SLACK

app.get('/slack/get-current-integration', authMiddleware, async (req, res) => {
    getCurrentSlackIntegration(req, res);
})

app.get('/slack/get-oauth-url', authMiddleware, async (req, res) => {
    getSlackOAuthUrl(req, res);
})

app.get('/slack/oauth-callback', async (req, res) => {
    slackOAuthCallback(req, res);
})

app.use('/slack/events', express.raw({ type: 'application/json' }));

app.post('/slack/events', async (req, res) => {
    await handleSlackEvent(req, res);
});

app.get('/integrations/status', authMiddleware, async (req, res) => {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const user = req.session.user;
    const integrations: { [key: string]: any } = {};

    try {
        // Check GitHub integration
        const userGithubRepo = await db().user_github_repositories.findFirst({ 
            where: { user_id: user.id } 
        });
        if (userGithubRepo) {
            const repo = await db().github_repositories.findUnique({ 
                where: { id: userGithubRepo.github_repository_id } 
            });
            if (repo) {
                integrations.github = { repositoryName: repo.name };
            }
        }

        // Check Linear integration
        const linearKey = await db().linear_api_keys.findUnique({ 
            where: { user_id: user.id } 
        });
        if (linearKey) {
            integrations.linear = { apiKey: linearKey.api_key };
        }

        // Check Jira integration
        const jiraKey = await db().jira_api_keys.findUnique({ 
            where: { user_id: user.id } 
        });
        if (jiraKey) {
            integrations.jira = { 
                apiKey: jiraKey.api_token, 
                baseUrl: jiraKey.base_url, 
                email: jiraKey.jira_user_email 
            };
        }

        // Check Slack integration
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: { user_id: user.id }
        });
        if (userSlackIntegration) {
            const slackIntegration = await db().slack_integrations.findFirst({
                where: { team_id: userSlackIntegration.slack_team_id }
            });
            if (slackIntegration) {
                integrations.slack = { teamName: slackIntegration.team_name };
            }
        }

        res.status(200).json({ integrations });
    } catch (error) {
        console.error('Error fetching integrations status:', error);
        res.status(500).json({ error: 'Failed to fetch integrations status' });
    }
});

server.listen(3001, () => {
    console.log('🚀 Express backend running on http://localhost:3001');
});

// Graceful shutdown
process.on("SIGTERM", () => {
    server.close();
});
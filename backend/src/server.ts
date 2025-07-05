import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { createServer } from "http";
import cors from 'cors';
import { User } from './types/prisma';
import { User as TicketUser } from './shared/TicketSystem';
import { authMiddleware, githubAppAuthMiddleware, githubCallback, githubLogin, login, logout } from './routes/auth';
import { AgentSocketServer, requestSessionSocketToken } from './agent/socket';
import { getInstallationUrl, githubAppInstallationCallback, githubAppInstallationDeleted, githubAppRecievedPush } from './routes/githubApp';
import { getLinearApiKey, setLinearApiKey } from './routes/linear';
import { LinearWebhooks, LINEAR_WEBHOOK_SIGNATURE_HEADER, LINEAR_WEBHOOK_TS_FIELD } from '@linear/sdk'
import { TicketManager } from './ticketing/TicketIntegration';

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

app.get('/auth/github/callback', async (req, res) => {
    githubCallback(req, res);
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

app.get('/github/installation-url', async (req, res) => {
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

// MARK: LINEAR

app.post('/linear/set-api-key', authMiddleware, async (req, res) => {
    setLinearApiKey(req, res);
})

app.get('/linear/get-api-key', authMiddleware, async (req, res) => {
    getLinearApiKey(req, res);
})

app.post('/webhooks/linear/:userId', async (req, res) => {
    console.log("Linear webhook received", req.body, req.params);
    const { userId } = req.params;
    const event = req.body;

    // Update your search index based on the event
    switch (event.type) {
        case 'Issue':
            console.log("Issue", event);
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

server.listen(3001, () => {
    console.log('🚀 Express backend running on http://localhost:3001');
});

// Graceful shutdown
process.on("SIGTERM", () => {
    server.close();
});
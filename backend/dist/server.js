import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { createServer } from "http";
import cors from 'cors';
import { authMiddleware, githubAppAuthMiddleware, githubCallback, githubLogin, login, logout } from './routes/auth.js';
import { AgentSocketServer, requestSessionSocketToken } from './agent/socket.js';
import { getCurrentGithubIntegration, getInstallationUrl, githubAppInstallationCallback, githubAppInstallationDeleted, githubAppRecievedPush } from './routes/githubApp.js';
import { getLinearApiKey, indexLinearTicket, setLinearApiKey } from './routes/linear.js';
import { getCurrentSlackIntegration, getSlackOAuthUrl, slackOAuthCallback } from './slack/registerApp.js';
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
});
app.get('/auth/github', async (req, res) => {
    githubLogin(req, res);
});
app.get('/auth/github/callback', async (req, res) => {
    githubCallback(req, res);
});
app.post('/login', async (req, res) => {
    login(req, res);
});
app.post('/logout', async (req, res) => {
    logout(req, res);
});
// MARK: SESSION
app.get('/session/token', authMiddleware, async (req, res) => {
    requestSessionSocketToken(req, res);
});
// MARK: GITHUB APP
app.get('/github/get-current-integration', authMiddleware, async (req, res) => {
    getCurrentGithubIntegration(req, res);
});
app.get('/github/installation-url', authMiddleware, async (req, res) => {
    getInstallationUrl(req, res);
});
app.post('/github/installation-callback', githubAppAuthMiddleware, async (req, res) => {
    githubAppInstallationCallback(req, res);
});
app.post('/github/installation-deleted', githubAppAuthMiddleware, async (req, res) => {
    githubAppInstallationDeleted(req, res);
});
app.post('/github/push-event', githubAppAuthMiddleware, async (req, res) => {
    githubAppRecievedPush(req, res);
});
// MARK: LINEAR
app.post('/linear/set-api-key', authMiddleware, async (req, res) => {
    setLinearApiKey(req, res);
});
app.get('/linear/get-api-key', authMiddleware, async (req, res) => {
    getLinearApiKey(req, res);
});
app.post('/webhooks/linear/:userId', async (req, res) => {
    const { userId } = req.params;
    const event = req.body;
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
});
app.get('/slack/get-oauth-url', authMiddleware, async (req, res) => {
    getSlackOAuthUrl(req, res);
});
app.get('/slack/oauth-callback', async (req, res) => {
    slackOAuthCallback(req, res);
});
server.listen(3001, () => {
    console.log('🚀 Express backend running on http://localhost:3001');
});
// Graceful shutdown
process.on("SIGTERM", () => {
    server.close();
});
//# sourceMappingURL=server.js.map
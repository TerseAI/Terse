import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { createServer } from "http";
import cors from 'cors';
import { authMiddleware, githubAppAuthMiddleware, githubCallback, githubLogin, login, logout } from './routes/auth.js';
import { AgentSocketServer, requestSessionSocketToken } from './agent/socket.js';
import { getInstallationUrl, githubAppInstallationCallback, githubAppInstallationDeleted, githubAppRecievedPush } from './routes/githubApp.js';
import { getLinearApiKey, setLinearApiKey } from './routes/linear.js';
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
app.get('/github/installation-url', async (req, res) => {
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
server.listen(3001, () => {
    console.log('🚀 Express backend running on http://localhost:3001');
});
// Graceful shutdown
process.on("SIGTERM", () => {
    server.close();
});
//# sourceMappingURL=server.js.map
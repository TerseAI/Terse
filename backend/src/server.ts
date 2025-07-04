import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { createServer } from "http";
import cors from 'cors';
import { User } from './types/prisma';
import { authMiddleware, githubAppAuthMiddleware, githubCallback, githubLogin, login, logout } from './routes/auth';
import { AgentSocketServer, requestSessionSocketToken } from './agent/socket';
import { getInstallationUrl } from './routes/githubApp';

export type Session = {
    user: User;
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
    console.log('githubAppInstallationCallback', req.body);
})

server.listen(3001, () => {
    console.log('🚀 Express backend running on http://localhost:3001');
});

// Graceful shutdown
process.on("SIGTERM", () => {
    server.close();
});
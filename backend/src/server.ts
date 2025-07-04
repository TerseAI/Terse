import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { createServer } from "http";
import cors from 'cors';
import { User } from './types/prisma';
import { authMiddleware, githubCallback, githubLogin, login, logout } from './routes/auth';
export type Session = {
    user: User;
}


const app = express();
const server = createServer(app);

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser());


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

server.listen(3001, () => {
    console.log('🚀 Express backend running on http://localhost:3001');
});

// Graceful shutdown
process.on("SIGTERM", () => {
    server.close();
});
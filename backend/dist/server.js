import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { createServer } from "http";
import cors from 'cors';
import { authMiddleware } from './routes/auth.js';
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
});
server.listen(3001, () => {
    console.log('🚀 Express backend running on http://localhost:3001');
});
// Graceful shutdown
process.on("SIGTERM", () => {
    server.close();
});
//# sourceMappingURL=server.js.map
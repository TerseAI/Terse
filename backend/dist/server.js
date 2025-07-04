import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { createServer } from "http";
import cors from 'cors';
const app = express();
const server = createServer(app);
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());
app.get('/me', (req, res) => {
    res.send('Hello World');
});
// Graceful shutdown
process.on("SIGTERM", () => {
    server.close();
});
//# sourceMappingURL=server.js.map
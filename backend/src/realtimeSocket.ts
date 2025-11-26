import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { Jwt } from "./utility/jwt";
import chalk from "chalk";
import { urls, nodeEnv, optional } from "./config/settings";
import { ModelRequest } from "./shared/ModelEvents";

// Extended Socket type with userId property
interface AuthenticatedSocket extends Socket {
    userId: string;
}

let io: Server | null = null;
let pub: ReturnType<typeof createClient> | null = null;
let sub: ReturnType<typeof createClient> | null = null;

export async function initializeRealtimeSocket(server: HttpServer): Promise<Server> {
    console.log(chalk.blue.bold("Initializing realtime socket: ", server.address()?.toString()));
    // Set up Socket.IO server
    io = new Server(server, {
        cors: {
            origin: getSocketCorsOrigin(),
            credentials: true,
        },
    });
    console.log(chalk.blue.bold("Socket.IO server initialized"));

    // Set up Redis adapter for Socket.IO (OPTIONAL - only needed for multi-server deployments)
    // 
    // By default, Socket.IO uses an in-memory adapter which is perfect for:
    // - Local development (single server instance)
    // - Single-server production deployments
    //
    // Only set REDIS_URL if you're running multiple server instances and need them to share socket state.
    // When REDIS_URL is not set, Socket.IO automatically uses the built-in in-memory adapter.
    //
    // To get Redis URL (only if needed for multi-server):
    // - Cloud (Redis Cloud, Upstash, AWS ElastiCache, etc.): Use the public endpoint URL they provide
    //   Format: redis://username:password@host:port or rediss://username:password@host:port (SSL)
    //
    const redisUrl = optional.redisUrl?.trim();
    if (redisUrl && redisUrl.length > 0) {
        try {
            // Validate URL format before creating client
            new URL(redisUrl);

            pub = createClient({ url: redisUrl });
            sub = pub.duplicate();

            await pub.connect();
            await sub.connect();
            io.adapter(createAdapter(pub, sub));
            console.log("✅ Redis adapter connected for Socket.IO");

        } catch (error) {
            console.warn(
                "⚠️  Invalid REDIS_URL format - Socket.IO running in single-server mode (no Redis adapter)"
            );
            console.warn("REDIS_URL should be in format: redis://host:port or rediss://host:port");
        }
    } else {
        console.log(
            "ℹ️  REDIS_URL not set - Socket.IO using in-memory adapter (perfect for local dev and single-server deployments)"
        );
    }

    // Authentication middleware
    io.use(async (socket: Socket, next) => {
        console.log(chalk.yellow.bold("Socket.IO connection attempt from:"), socket.handshake.address);
        console.log(chalk.yellow.bold("Socket.IO handshake headers:"), {
            origin: socket.handshake.headers.origin,
            referer: socket.handshake.headers.referer,
        });
        // Verify JWT token from auth
        const token = socket.handshake.auth?.token;
        if (!token) {
            console.log(chalk.red.bold("Socket.IO auth failed: No token provided"));
            return next(new Error("Authentication token required"));
        }

        try {
            const user = await new Jwt().verify(token);
            if (!user) {
                console.log(chalk.red.bold("Socket.IO auth failed: Invalid token"));
                return next(new Error("Invalid token"));
            }
            console.log(chalk.blue.bold("User in socket authenticated"), user.id);
            (socket as AuthenticatedSocket).userId = user.id;
            next();
        } catch (error) {
            console.log(chalk.red.bold("Socket.IO auth failed:"), error);
            next(new Error("Authentication failed"));
        }
    });

    // Connection handler
    io.on("connection", (socket: Socket) => {
        const authenticatedSocket = socket as AuthenticatedSocket;
        const userId = authenticatedSocket.userId;
        const room = `user:${userId}`;
        console.log(chalk.green.bold(`Socket.IO connection established for user ${userId}, room: ${room}`));

        socket.join(room);

        // Listen for channel chat messages
        socket.on("channel:chat:message", async (payload: { runId: string | null; message: ModelRequest }) => {
            const { runId, message } = payload;
            console.log(chalk.blue.bold(`[channel:chat:message] Received message for runId: ${runId}`), message, userId);
            
            // TODO: Implement message processing logic here
            // This could involve:
            // 1. Getting the run record to find the channelId
            // 2. Creating/continuing a ChannelAgent for that channel
            // 3. Processing the message and streaming the response back
        });

        // presence: mark online (60s TTL), refresh every 25s (only if Redis is available)
        if (pub) {
            const key = `presence:${room}`;
            pub.set(key, "1", { EX: 60 }).catch(() => { });
            const refresh = setInterval(
                () => pub!.expire(key, 60).catch(() => { }),
                25_000
            );

            socket.on("disconnect", () => {
                clearInterval(refresh);
                // Optional: check if other sockets for this user still exist before deleting presence
                // Otherwise let TTL expire naturally.
            });
        }
    });

    return io;
}

export function getRealtimeSocket(): Server | null {
    return io;
}

export function emitCacheInvalidationWithKey(
    userId: string,
    key: string
) {
    if (!io) {
        console.warn("Socket.IO server not initialized");
        return;
    }
    io.to(`user:${userId}`).emit("invalidate", { key });
}

export function emitCacheInvalidationWithWildcard(
    userId: string,
    key: string,
    id: string
) {
    if (!io) {
        console.warn("Socket.IO server not initialized");
        return;
    }
    // Send tag-based invalidation payload
    // If id is provided, frontend will match on both tag and id
    // If id is not provided, frontend will match on tag only
    io.to(`user:${userId}`).emit("invalidate", { key, id });
}

function getSocketCorsOrigin(): boolean | string | string[] {
    const isProd = nodeEnv === "production";

    let socketCorsOrigin: boolean | string | string[];

    if (urls.socketFrontend) {
        socketCorsOrigin = [urls.socketFrontend];
    } else if (isProd) {
        console.error(
            "[Socket.IO] SOCKET_FRONTEND_URL (urls.socketFrontend) is not set in production. " +
            "Blocking all cross-origin Socket.IO connections for safety."
        );
        socketCorsOrigin = false; // or throw if you prefer hard failure
    } else {
        // In dev, be permissive and echo back any origin
        socketCorsOrigin = true;
    }

    return socketCorsOrigin;
}
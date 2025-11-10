import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { Jwt } from "./utility/jwt";
import chalk from "chalk";

// Extended Socket type with userId property
interface AuthenticatedSocket extends Socket {
    userId: string;
}

let io: Server | null = null;
let pub: ReturnType<typeof createClient> | null = null;
let sub: ReturnType<typeof createClient> | null = null;

export async function initializeRealtimeSocket(server: HttpServer): Promise<Server> {
    console.log(chalk.blue.bold("Initializing realtime socket"));
    // Set up Socket.IO server
    io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL
                ? [process.env.FRONTEND_URL]
                : process.env.NODE_ENV === "production"
                    ? false // Deny all in production if FRONTEND_URL not set (security)
                    : true, // Allow all in development (matches Express CORS config)
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
    const redisUrl = process.env.REDIS_URL?.trim();
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
        // Verify JWT token from auth
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error("Authentication token required"));
        }

        try {
            const user = await new Jwt().verify(token);
            if (!user) {
                return next(new Error("Invalid token"));
            }
            console.log(chalk.blue.bold("User in socket authenticated"), user.id);
            (socket as AuthenticatedSocket).userId = user.id;
            next();
        } catch (error) {
            next(new Error("Authentication failed"));
        }
    });

    // Connection handler
    io.on("connection", (socket: Socket) => {
        console.log("Socket.IO connection established");
        const authenticatedSocket = socket as AuthenticatedSocket;
        const userId = authenticatedSocket.userId;
        const room = `user:${userId}`;

        socket.join(room);

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
    io.to(`user:${userId}`).emit("invalidate", key);
}

export function emitCacheInvalidationWithKeyId(
    userId: string,
    key: string,
    id: string
) {
    if (!io) {
        console.warn("Socket.IO server not initialized");
        return;
    }
    io.to(`user:${userId}`).emit("invalidate", [key, id]);
}

export function emitCacheInvalidationWithWildcard(
    userId: string,
    tag: string,
    id?: string
) {
    if (!io) {
        console.warn("Socket.IO server not initialized");
        return;
    }
    // Send tag-based invalidation payload
    // If id is provided, frontend will match on both tag and id
    // If id is not provided, frontend will match on tag only
    io.to(`user:${userId}`).emit("invalidate", { tag, id });
}
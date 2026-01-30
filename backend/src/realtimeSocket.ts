import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { Jwt } from "./utility/jwt";
import { urls, nodeEnv, optional } from "./config/settings";
import { SendModelRequest, ModelEvent, ToolApprovalResponse } from "./shared/ModelEvents";
import { db } from "./prismaClient";
import { RunContext } from "./agent/AgentRunner/SystemPromptBuilder";
import { hydrateAgentById, createAgentRunner, formatHydrationError } from "./agent/AgentRunner/AgentHydration";
import { storeChatEvent, markRunFailed, finalizeRunStatus } from "./agent/AgentRunner/runHistory";
import { DirectiveTask, directiveTaskQueue } from "./agent/DirectiveAgent/DirectiveAgent";
import { ApprovalService } from "./services/ApprovalService";
import logger from "./logger";
import { SocketEvents, SocketRooms } from "./shared/SocketEvents";
import { registerBuilderChatHandler } from "./socketHandlers/builderChatHandler";
import { emitCacheInvalidationWithWildcard } from "./services/CacheInvalidationService";

// Extended Socket type with userId property
interface AuthenticatedSocket extends Socket {
    userId: string;
}

let io: Server | null = null;
let pub: ReturnType<typeof createClient> | null = null;
let sub: ReturnType<typeof createClient> | null = null;

export async function initializeRealtimeSocket(server: HttpServer): Promise<Server> {
    logger.info("Initializing realtime socket", { address: server.address()?.toString() });
    // Set up Socket.IO server
    io = new Server(server, {
        cors: {
            origin: getSocketCorsOrigin(),
            credentials: true,
        },
    });
    logger.info("Socket.IO server initialized");

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
            logger.info("✅ Redis adapter connected for Socket.IO");

        } catch (error) {
            logger.warn(
                "⚠️  Invalid REDIS_URL format - Socket.IO running in single-server mode (no Redis adapter)",
                { error }
            );
            logger.warn("REDIS_URL should be in format: redis://host:port or rediss://host:port");
        }
    } else {
        logger.info(
            "ℹ️  REDIS_URL not set - Socket.IO using in-memory adapter (perfect for local dev and single-server deployments)"
        );
    }

    // Authentication middleware
    io.use(async (socket: Socket, next) => {
        logger.info("Socket.IO connection attempt", { address: socket.handshake.address });
        logger.info("Socket.IO handshake headers", {
            origin: socket.handshake.headers.origin,
            referer: socket.handshake.headers.referer,
        });
        // Verify JWT token from auth
        const token = socket.handshake.auth?.token;
        if (!token) {
            logger.warn("Socket.IO auth failed: No token provided");
            return next(new Error("Authentication token required"));
        }

        try {
            const user = await new Jwt().verify(token);
            if (!user) {
                logger.warn("Socket.IO auth failed: Invalid token");
                return next(new Error("Invalid token"));
            }
            logger.info("User in socket authenticated", { userId: user.id });
            (socket as AuthenticatedSocket).userId = user.id;
            next();
        } catch (error) {
            logger.error("Socket.IO auth failed", { error });
            next(new Error("Authentication failed"));
        }
    });

    // Connection handler
    io.on(SocketEvents.CONNECT, (socket: Socket) => {
        const authenticatedSocket = socket as AuthenticatedSocket;
        const userId = authenticatedSocket.userId;
        const room = SocketRooms.user(userId);
        logger.info(`Socket.IO connection established for user ${userId}`, { userId, room });

        socket.join(room);

        // Listen for agent chat messages
        socket.on(SocketEvents.AGENT_CHAT_MESSAGE, async (payload: { runId: string | null; message: SendModelRequest }) => {
            const { runId, message } = payload;
            logger.info(`[agent:chat:message] Received message for runId: ${runId}`, { runId, userId, message });
            if (!runId) {
                logger.error(`[agent:chat:message] No runId provided for message`, { message, userId });
                return;
            }
            const prisma = db();
            const runRecord = await prisma.run_history_records.findUnique({
                where: {
                    id: runId
                },
                include: {
                    automation: true
                }
            });
            if (!runRecord || !runRecord.automation || runRecord.automation.user_id !== userId) {
                logger.error(`[agent:chat:message] Run record not found for runId: ${runId} or user does not have access to this run`, { runId, userId });
                return;
            }

            // Hydrate agent with all dependencies (outputs, knowledge bases, session)
            const hydrationResult = await hydrateAgentById(runRecord.automation.id, userId);
            if (!hydrationResult.success) {
                logger.error(`[agent:chat:message] ${formatHydrationError(hydrationResult.error)}`, { runId, userId });
                return;
            }

            const { agent, user, session } = hydrationResult.data;
            const userMessage = message.user_message;

            // Ensure run status is 'in_progress' so streaming works
            if (runRecord.status !== 'in_progress') {
                await prisma.run_history_records.update({
                    where: { id: runId },
                    data: { status: 'in_progress' },
                });
            }
            const userMessageEvent: ModelEvent = {
                type: 'UserMessage',
                message: userMessage,
            };
            const userMessageEventId = await storeChatEvent(runId, userMessageEvent);
            emitCacheInvalidationWithWildcard(user.id, 'runHistory', agent.id);
            emitCacheInvalidationWithWildcard(user.id, 'chatHistory', runId);

            const runContext: RunContext = { runId };
            const agentRunner = createAgentRunner(hydrationResult.data, runContext);
            await agentRunner.initializeAgent();

            let result;
            try {
                result = await agentRunner.userMessageRun(userMessage, [], {
                    runId,
                    userId: userId,
                    agentId: agent.id,
                });
            } catch (error) {
                // Log the error and update run history
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`[agent:chat:message] Error running agent: ${errorMessage}`, { error, runId, agentId: agent.id, userId });

                try {
                    await markRunFailed(runId, errorMessage, 'agent');
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', agent.id);
                } catch (e) {
                    logger.error('Failed to mark run as failed', { error: e, runId });
                }
                return;
            }

            // Finalize run status based on result, just like in EventProcessor
            if (result.status === 'completed') {
                const hasFinalOutput = Boolean(result.result?.finalOutput);
                try {
                    await finalizeRunStatus(runId, hasFinalOutput ? 'success' : 'failed');
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', agent.id);
                } catch (e) {
                    logger.error('Failed to finalize run status', { error: e, runId });
                }
            }

            directiveTaskQueue.emit(new DirectiveTask(
                agent.id,
                runId,
                userMessageEventId,
                userId,
                userMessage,
            ));

        });

        // Listen for tool approval responses
        socket.on(SocketEvents.AGENT_CHAT_APPROVAL, async (payload: { runId: string; message: ToolApprovalResponse }) => {
            const { runId, message } = payload;
            logger.info(`[agent:chat:approval] Received approval response`, { message, userId, runId });

            if (!runId) {
                logger.error(`[agent:chat:approval] No runId provided`);
                return;
            }

            // Use centralized approval service - it handles Slack notifications internally
            const result = await ApprovalService.processApproval({
                runId,
                stepId: message.step_id,
                approved: message.approved,
                userId,
            });

            if (result.status === 'failed' && result.error) {
                logger.error(`[agent:chat:approval] Approval processing failed: ${result.error}`);
            } else {
                logger.info(`[agent:chat:approval] Successfully processed approval for runId: ${runId}`);
            }
        });

        // Listen for builder chat messages (in-app agent builder)
        registerBuilderChatHandler(socket, userId);

        // presence: mark online (60s TTL), refresh every 25s (only if Redis is available)
        if (pub) {
            const key = `presence:${room}`;
            pub.set(key, "1", { EX: 60 }).catch(() => { });
            const refresh = setInterval(
                () => pub!.expire(key, 60).catch(() => { }),
                25_000
            );

            socket.on(SocketEvents.DISCONNECT, () => {
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

function getSocketCorsOrigin(): boolean | string | string[] {
    const isProd = nodeEnv === "production";

    let socketCorsOrigin: boolean | string | string[];

    if (urls.socketFrontend) {
        socketCorsOrigin = [urls.socketFrontend];
    } else if (isProd) {
        logger.error(
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
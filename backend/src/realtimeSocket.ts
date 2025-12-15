import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { Jwt } from "./utility/jwt";
import chalk from "chalk";
import { urls, nodeEnv, optional } from "./config/settings";
import { SendModelRequest, ModelEvent, ModelRequest, ToolApprovalResponse } from "./shared/ModelEvents";
import { db } from "./prismaClient";
import { ChannelAgent } from "./agent/ChannelAgent/ChannelAgent";
import { RunContext } from "./agent/ChannelAgent/SystemPromptBuilder";
import { ChannelWithRelations } from "./types/prisma";
import { getInputConfigInclude, getOutputConfigInclude } from './utility/prismaIncludes';
import { OutputFactory } from "./outputs/abstract/OutputFactory";
import { Session } from "./server";
import { storeChatEvent, markRunFailed, finalizeRunStatus } from "./agent/ChannelAgent/runHistory";
import { DirectiveTask, directiveTaskQueue } from "./agent/DirectiveAgent/DirectiveAgent";

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
        socket.on("channel:chat:message", async (payload: { runId: string | null; message: SendModelRequest }) => {
            const { runId, message } = payload;
            console.log(chalk.blue.bold(`[channel:chat:message] Received message for runId: ${runId}`), message, userId);
            if (!runId) {
                console.error(chalk.red.bold(`[channel:chat:message] No runId provided for message: ${message}`));
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
                console.error(chalk.red.bold(`[channel:chat:message] Run record not found for runId: ${runId} or user does not have access to this run`));
                return;
            }

            const channel: ChannelWithRelations | null = await prisma.automations.findUnique({
                where: {
                    id: runRecord.automation.id,
                    user_id: userId
                },
                include: {
                    prompt: true,
                    inputs: {
                        include: getInputConfigInclude()
                    },
                    output: {
                        include: getOutputConfigInclude()
                    }
                }
            }) as ChannelWithRelations | null;

            if (!channel) {
                console.error(chalk.red.bold(`[channel:chat:message] Channel not found for automation id: ${runRecord.automation.id}`));
                return;
            }

            const outputIntegration = channel.output;
            if (!outputIntegration) {
                console.error(chalk.red.bold(`[channel:chat:message] No output integration found for channel: ${channel.id}`));
                return;
            }

            // Use OutputFactory to create output based on config type (no hardcoded Notion logic)
            const output = OutputFactory.createOutput(outputIntegration.config_type);
            if (!output) {
                console.error(chalk.red.bold(`[channel:chat:message] Output type ${outputIntegration.config_type} is not supported for channel: ${channel.id}`));
                return;
            }

            const user = await prisma.users.findUnique({
                where: {
                    id: userId
                }
            });
            if(!user) {
                console.error(chalk.red.bold(`[channel:chat:message] User not found for userId: ${userId}`));
                return;
            }
            

            // Use output's config-aware session creation (no hardcoded config extraction)
            // Each output type knows how to fetch its own integration and extract its config
            let session: Session;
            try {
                session = await output.createSessionFromConfig(
                    outputIntegration.integration_id,
                    outputIntegration,
                    user
                );
            } catch (error) {
                console.error(chalk.red.bold(`[channel:chat:message] Failed to create session: ${error}`));
                return;
            }

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
            emitCacheInvalidationWithWildcard(user.id, 'runHistory', channel.id);
            emitCacheInvalidationWithWildcard(user.id, 'chatHistory', runId);


            const runContext: RunContext = { runId };
            const channelAgent = new ChannelAgent(session, output, channel, runContext);
            await channelAgent.initializeAgent();
            
            let result;
            try {
                result = await channelAgent.userMessageRun(userMessage, {
                    runId,
                    userId: userId,
                    channelId: channel.id,
                });
            } catch (error) {
                // Log the error and update run history
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(chalk.red.bold(`[channel:chat:message] Error running channel agent: ${errorMessage}`), error);
                
                try {
                    await markRunFailed(runId, errorMessage, 'agent');
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
                } catch (e) {
                    console.error(chalk.yellow('Failed to mark run as failed'), e);
                }
                return;
            }

            // Finalize run status based on result, just like in EventProcessor
            if (result.status === 'completed') {
                const hasFinalOutput = Boolean(result.result?.finalOutput);
                try {
                    await finalizeRunStatus(runId, hasFinalOutput ? 'success' : 'failed');
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
                } catch (e) {
                    console.error(chalk.yellow('Failed to finalize run status'), e);
                }
            }

            directiveTaskQueue.emit(new DirectiveTask(
                channel.id,
                runId,
                userMessageEventId,
                userId,
                userMessage,
            ));

        });

        // Listen for tool approval responses
        socket.on("channel:chat:approval", async (payload: { runId: string; message: ToolApprovalResponse }) => {
            const { runId, message } = payload;
            console.log(chalk.blue.bold(`[channel:chat:approval] Received approval response for runId: ${runId}`), message, userId);

            if (!runId) {
                console.error(chalk.red.bold(`[channel:chat:approval] No runId provided`));
                return;
            }

            const prisma = db();
            const runRecord = await prisma.run_history_records.findUnique({
                where: { id: runId },
                include: { automation: true }
            });

            if (!runRecord || !runRecord.automation || runRecord.automation.user_id !== userId) {
                console.error(chalk.red.bold(`[channel:chat:approval] Run record not found or user does not have access`));
                return;
            }

            const channel: ChannelWithRelations | null = await prisma.automations.findUnique({
                where: {
                    id: runRecord.automation.id,
                    user_id: userId
                },
                include: {
                    prompt: true,
                    inputs: {
                        include: getInputConfigInclude()
                    },
                    output: {
                        include: getOutputConfigInclude()
                    }
                }
            }) as ChannelWithRelations | null;

            if (!channel) {
                console.error(chalk.red.bold(`[channel:chat:approval] Channel not found`));
                return;
            }

            const outputIntegration = channel.output;
            if (!outputIntegration) {
                console.error(chalk.red.bold(`[channel:chat:approval] No output integration found`));
                return;
            }

            const output = OutputFactory.createOutput(outputIntegration.config_type);
            if (!output) {
                console.error(chalk.red.bold(`[channel:chat:approval] Output type not supported`));
                return;
            }

            const user = await prisma.users.findUnique({
                where: { id: userId }
            });

            if (!user) {
                console.error(chalk.red.bold(`[channel:chat:approval] User not found`));
                return;
            }

            let session: Session;
            try {
                session = await output.createSessionFromConfig(
                    outputIntegration.integration_id,
                    outputIntegration,
                    user
                );
            } catch (error) {
                console.error(chalk.red.bold(`[channel:chat:approval] Failed to create session: ${error}`));
                return;
            }

            // Ensure run status is 'in_progress' for streaming
            if (runRecord.status !== 'in_progress') {
                await prisma.run_history_records.update({
                    where: { id: runId },
                    data: { status: 'in_progress' },
                });
            }

            const runContext: RunContext = { runId };
            const channelAgent = new ChannelAgent(session, output, channel, runContext);
            await channelAgent.initializeAgent();

            try {
                const decision: 'approve' | 'reject' = message.approved ? 'approve' : 'reject';
                const result = await channelAgent.resumeFromPendingApproval(
                    decision,
                    message.step_id,
                    {
                        runId,
                        userId: userId,
                        channelId: channel.id,
                    }
                );

                // Finalize run status based on result
                if (result.status === 'completed') {
                    const hasFinalOutput = Boolean(result.result?.finalOutput);
                    try {
                        await finalizeRunStatus(runId, hasFinalOutput ? 'success' : 'failed');
                        emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
                    } catch (e) {
                        console.error(chalk.yellow('Failed to finalize run status'), e);
                    }
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(chalk.red.bold(`[channel:chat:approval] Error resuming agent: ${errorMessage}`), error);

                try {
                    await markRunFailed(runId, errorMessage, 'agent');
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
                } catch (e) {
                    console.error(chalk.yellow('Failed to mark run as failed'), e);
                }
            }
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
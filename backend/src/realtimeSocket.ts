import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { Jwt } from "./utility/jwt";
import { urls, nodeEnv, optional } from "./config/settings";
import { SendModelRequest, ModelEvent, ModelRequest, ToolApprovalResponse } from "./shared/ModelEvents";
import { db } from "./prismaClient";
import { ChannelAgent } from "./agent/ChannelAgent/ChannelAgent";
import { RunContext } from "./agent/ChannelAgent/SystemPromptBuilder";
import { ChannelWithRelations, ChannelKnowledgeBaseWithConfigs, ChannelOutputWithConfigs } from "./types/prisma";
import { getInputConfigInclude, getOutputConfigInclude, getKnowledgeBaseConfigInclude } from './utility/prismaIncludes';
import { OutputFactory } from "./outputs/abstract/OutputFactory";
import { Output } from "./outputs/abstract/Output";
import { KnowledgeBaseFactory } from "./knowledgeBase/abstract/KnowledgeBaseFactory";
import { KnowledgeBase } from "./knowledgeBase/abstract/KnowledgeBase";
import { ConfigInstance } from "./shared/Configs";
import { Session } from "./server";
import { storeChatEvent, markRunFailed, finalizeRunStatus } from "./agent/ChannelAgent/runHistory";
import { DirectiveTask, directiveTaskQueue } from "./agent/DirectiveAgent/DirectiveAgent";
import { ApprovalService } from "./services/ApprovalService";
import logger from "./logger";

// Extended Socket type with userId property
interface AuthenticatedSocket extends Socket {
    userId: string;
}

let io: Server | null = null;
let pub: ReturnType<typeof createClient> | null = null;
let sub: ReturnType<typeof createClient> | null = null;

function createKnowledgeBases(
    channelKnowledgeBases: ChannelWithRelations['knowledge_bases']
): { knowledgeBases: KnowledgeBase<Session, ConfigInstance>[]; channelConfigs: ChannelKnowledgeBaseWithConfigs[] } {
    if (!channelKnowledgeBases || channelKnowledgeBases.length === 0) {
        return { knowledgeBases: [], channelConfigs: [] };
    }

    // Create knowledge base instances and maintain pairing with channel configs
    const knowledgeBases: KnowledgeBase<Session, ConfigInstance>[] = [];
    const channelConfigs: ChannelKnowledgeBaseWithConfigs[] = [];
    
    for (const channelKnowledgeBase of channelKnowledgeBases) {
        const kb = KnowledgeBaseFactory.createKnowledgeBase(channelKnowledgeBase.config_type);
        if (kb) {
            knowledgeBases.push(kb);
            channelConfigs.push(channelKnowledgeBase as ChannelKnowledgeBaseWithConfigs);
        }
    }
    
    return { knowledgeBases, channelConfigs };
}

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
    io.on("connection", (socket: Socket) => {
        const authenticatedSocket = socket as AuthenticatedSocket;
        const userId = authenticatedSocket.userId;
        const room = `user:${userId}`;
        logger.info(`Socket.IO connection established for user ${userId}`, { userId, room });

        socket.join(room);

        // Listen for channel chat messages
        socket.on("channel:chat:message", async (payload: { runId: string | null; message: SendModelRequest }) => {
            const { runId, message } = payload;
            logger.info(`[channel:chat:message] Received message for runId: ${runId}`, { runId, userId, message });
            if (!runId) {
                logger.error(`[channel:chat:message] No runId provided for message`, { message, userId });
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
                logger.error(`[channel:chat:message] Run record not found for runId: ${runId} or user does not have access to this run`, { runId, userId });
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
                    outputs: {
                        include: getOutputConfigInclude()
                    },
                    knowledge_bases: {
                        include: getKnowledgeBaseConfigInclude()
                    }
                }
            })

            if (!channel || !channel.outputs || channel.outputs.length === 0) {
                logger.error(`[channel:chat:message] Channel not found or has no outputs for automation id: ${runRecord.automation.id}`, { automationId: runRecord.automation.id, userId });
                return;
            }

            // Get the first output for chat (can be extended to handle multiple outputs)
            const outputIntegration = channel.outputs[0];
            if (!outputIntegration) {
                logger.error(`[channel:chat:message] No output integration found for channel: ${channel.id}`, { channelId: channel.id, userId });
                return;
            }

            // Use OutputFactory to create output based on config type (no hardcoded Notion logic)
            const output = OutputFactory.createOutput(outputIntegration.config_type);
            if (!output) {
                logger.error(`[channel:chat:message] Output type ${outputIntegration.config_type} is not supported for channel: ${channel.id}`, { configType: outputIntegration.config_type, channelId: channel.id, userId });
                return;
            }

            const user = await prisma.users.findUnique({
                where: {
                    id: userId
                }
            });
            if(!user) {
                logger.error(`[channel:chat:message] User not found for userId: ${userId}`, { userId });
                return;
            }
            

            // Create output instances and sessions for all outputs
            const outputs: Output<Session, ConfigInstance>[] = [];
            const outputSessions: Session[] = [];
            const outputChannelConfigs: ChannelOutputWithConfigs[] = [];

            for (const outIntegration of channel.outputs) {
                const out = OutputFactory.createOutput(outIntegration.config_type);
                if (!out) {
                    logger.error(`[channel:chat:message] Output type ${outIntegration.config_type} is not supported`, { configType: outIntegration.config_type });
                    continue;
                }

                try {
                    const outSession = await out.createSessionFromConfig(
                        outIntegration.integration_id,
                        outIntegration,
                        user
                    );

                    outputs.push(out);
                    outputSessions.push(outSession);
                    outputChannelConfigs.push(outIntegration);
                } catch (error) {
                    logger.error(`[channel:chat:message] Failed to create session for output ${outIntegration.config_type}`, { error, configType: outIntegration.config_type });
                    continue;
                }
            }

            if (outputs.length === 0) {
                logger.error(`[channel:chat:message] Failed to create any output sessions for channel: ${channel.id}`, { channelId: channel.id });
                return;
            }

            // Use the first output session as the primary session
            const session = outputSessions[0];

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

            // Create knowledge bases from channel configuration
            const { knowledgeBases, channelConfigs } = createKnowledgeBases(channel.knowledge_bases || []);

            const runContext: RunContext = { runId };
            const channelAgent = new ChannelAgent(session, outputs, outputSessions, outputChannelConfigs, knowledgeBases, channelConfigs, channel, runContext);
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
                logger.error(`[channel:chat:message] Error running channel agent: ${errorMessage}`, { error, runId, channelId: channel.id, userId });
                
                try {
                    await markRunFailed(runId, errorMessage, 'agent');
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
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
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
                } catch (e) {
                    logger.error('Failed to finalize run status', { error: e, runId });
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
            logger.info(`[channel:chat:approval] Received approval response`, { message, userId, runId });

            if (!runId) {
                logger.error(`[channel:chat:approval] No runId provided`);
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
                logger.error(`[channel:chat:approval] Approval processing failed: ${result.error}`);
            } else {
                logger.info(`[channel:chat:approval] Successfully processed approval for runId: ${runId}`);
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
        logger.warn("Socket.IO server not initialized");
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
        logger.warn("Socket.IO server not initialized");
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
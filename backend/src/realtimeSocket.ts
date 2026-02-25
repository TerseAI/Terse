import { createAdapter } from "@socket.io/redis-adapter"
import { Server as HttpServer } from "http"
import { jwtVerify } from "jose"
import { createClient } from "redis"
import { Server, Socket } from "socket.io"

import { AgentRunResultStatus, AgentRunner } from "./agent/AgentRunner/AgentRunner"
import { RunContext } from "./agent/AgentRunner/SystemPromptBuilder"
import { evaluateCompletedRun, finalizeRunStatus, getPendingApprovalState, markRunFailed } from "./agent/AgentRunner/runHistory"
import { DirectiveTask, directiveTaskQueue } from "./agent/DirectiveAgent/DirectiveAgent"
import { type ClassifiedError, buildRunErrorEvent, classifyAgentError } from "./agent/agentErrorUtils"
import { appendRunHistoryErrorSystemEvent } from "./agent/systemEvents/runErrorSystemEvent"
import { nodeEnv, optional, urls } from "./config/settings"
import logger from "./logger"
import { NotificationManager } from "./notifications/Notification"
import { Output } from "./outputs/abstract/Output"
import { OutputFactory } from "./outputs/abstract/OutputFactory"
import { db } from "./prismaClient"
import { Session } from "./server"
import { ApprovalProcessingStatus, ApprovalService } from "./services/ApprovalService"
import { ConfigInstance } from "./shared/Configs"
import { SendModelRequest, ToolApprovalResponse } from "./shared/ModelEvents"
import { type RunHistoryModelEvent, type RunHistoryModelSocketEvent, RunHistoryStatus } from "./shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "./shared/SocketEvents"
import { registerBuilderChatHandler } from "./socketHandlers/builderChatHandler"
import { AgentWithRelations } from "./types/prisma"
import { getInputConfigInclude, getOutputConfigInclude } from "./utility/prismaIncludes"
import { randomString } from "./utility/strings"
import { getUserForOrg, workos } from "./utility/workos"

// Extended Socket type with userId, organizationId, and WorkOS session ID
interface AuthenticatedSocket extends Socket {
    userId: string
    organizationId: string | undefined
    workosSessionId?: string // From JWT sid claim - used to target session-specific events
}

let io: Server | null = null
let pub: ReturnType<typeof createClient> | null = null
let sub: ReturnType<typeof createClient> | null = null

export async function initializeRealtimeSocket(server: HttpServer): Promise<Server> {
    logger.info("Initializing realtime socket", {
        address: server.address()?.toString()
    })
    // Set up Socket.IO server
    io = new Server(server, {
        cors: {
            origin: getSocketCorsOrigin(),
            credentials: true
        }
    })
    logger.info("Socket.IO server initialized")

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
    const redisUrl = optional.redisUrl?.trim()
    if (redisUrl && redisUrl.length > 0) {
        try {
            // Validate URL format before creating client
            new URL(redisUrl)

            pub = createClient({ url: redisUrl })
            sub = pub.duplicate()

            await pub.connect()
            await sub.connect()
            io.adapter(createAdapter(pub, sub))
            logger.info("✅ Redis adapter connected for Socket.IO")
        } catch (error) {
            logger.warn("⚠️  Invalid REDIS_URL format - Socket.IO running in single-server mode (no Redis adapter)", { error })
            logger.warn("REDIS_URL should be in format: redis://host:port or rediss://host:port")
        }
    } else {
        logger.info("ℹ️  REDIS_URL not set - Socket.IO using in-memory adapter (perfect for local dev and single-server deployments)")
    }

    // Authentication middleware: verify WorkOS access token via JWKS
    io.use(async (socket: Socket, next) => {
        logger.info("Socket.IO connection attempt", {
            address: socket.handshake.address
        })
        logger.info("Socket.IO handshake headers", {
            origin: socket.handshake.headers.origin,
            referer: socket.handshake.headers.referer
        })
        const token = socket.handshake.auth?.token
        if (!token) {
            logger.warn("Socket.IO auth failed: No token provided")
            return next(new Error("Authentication token required"))
        }

        try {
            const jwks = await workos.userManagement.getJWKS()
            if (!jwks) {
                logger.warn("Socket.IO auth failed: JWKS not available (missing clientId)")
                return next(new Error("Authentication failed"))
            }
            const { payload } = await jwtVerify(token, jwks)

            const workosUserId = payload.sub as string
            const organizationId = payload.org_id as string | undefined
            const workosSessionId = payload.sid as string | undefined // WorkOS session ID - used for session-specific logout

            const dbUser = await db().users.findUnique({
                where: { workos_id: workosUserId }
            })

            if (!dbUser) {
                logger.warn("Socket.IO auth failed: User not found", {
                    workosUserId
                })
                return next(new Error("User not found"))
            }

            logger.info("User in socket authenticated", {
                userId: dbUser.id,
                organizationId: organizationId ?? "(none)"
            })
            const authSocket = socket as AuthenticatedSocket
            authSocket.userId = dbUser.id
            authSocket.organizationId = organizationId
            authSocket.workosSessionId = workosSessionId
            next()
        } catch (error) {
            logger.error("Socket.IO auth failed", { error })
            next(new Error("Authentication failed"))
        }
    })

    // Connection handler
    io.on(SocketEvents.CONNECT, async (socket: Socket) => {
        const authenticatedSocket = socket as AuthenticatedSocket
        const userId = authenticatedSocket.userId
        const organizationId = authenticatedSocket.organizationId
        const workosSessionId = authenticatedSocket.workosSessionId
        const userRoom = SocketRooms.user(userId)
        const orgRoom = organizationId ? SocketRooms.organization(organizationId) : null
        const sessionRoom = workosSessionId ? SocketRooms.session(workosSessionId) : null
        logger.info(`Socket.IO connection established for user ${userId}`, {
            userId,
            userRoom,
            orgRoom: orgRoom ?? "(none)"
        })

        socket.join(userRoom)
        if (orgRoom) {
            socket.join(orgRoom)
        }
        if (sessionRoom) {
            socket.join(sessionRoom)
        }

        // Listen for agent chat messages
        socket.on(SocketEvents.AGENT_CHAT_MESSAGE, async (payload: { runId: string | null; message: SendModelRequest }) => {
            const { runId, message } = payload
            logger.info(`[agent:chat:message] Received message for runId: ${runId}`, { runId, userId, message })
            if (!runId) {
                logger.error(`[agent:chat:message] No runId provided for message`, {
                    message,
                    userId
                })
                return
            }
            const prisma = db()
            const runRecord = await prisma.run_history_records.findUnique({
                where: {
                    id: runId
                },
                include: {
                    automation: true
                }
            })
            if (!runRecord || !runRecord.automation || runRecord.automation.organization_id !== organizationId) {
                logger.error(`[agent:chat:message] Run record not found for runId: ${runId} or user does not have access to this run`, { runId, userId, organizationId })
                return
            }

            const agent: AgentWithRelations | null = await prisma.automations.findUnique({
                where: {
                    id: runRecord.automation.id,
                    organization_id: organizationId
                },
                include: {
                    prompt: true,
                    inputs: {
                        include: getInputConfigInclude()
                    },
                    outputs: {
                        include: getOutputConfigInclude()
                    },
                    tool_approvals: true
                }
            })

            if (!agent) {
                logger.error(`[agent:chat:message] Agent not found for automation id: ${runRecord.automation.id}`, { automationId: runRecord.automation.id, userId })
                return
            }

            if (!agent.outputs || agent.outputs.length === 0) {
                logger.error(`[agent:chat:message] No output integrations found for agent: ${agent.id}`, { agentId: agent.id, userId })
                return
            }

            // Create outputs from agent configuration
            let outputs: Output<ConfigInstance>[]
            try {
                outputs = OutputFactory.createOutputsFromAgent(agent)
            } catch (error) {
                logger.error(`[agent:chat:message] Failed to create outputs for agent: ${agent.id}`, { error, agentId: agent.id, userId })
                return
            }

            if (!organizationId) {
                logger.error(`[agent:chat:message] No organization context for runId: ${runId}`, { runId, userId })
                return
            }
            const user = await getUserForOrg(userId, organizationId)
            if (!user) {
                logger.error(`[agent:chat:message] User not found for userId: ${userId}`, { userId })
                return
            }

            // Create base session for AgentRunner
            const session: Session = {
                user,
                isUserInitiated: true
            }

            const userMessage = message.user_message

            const pendingApprovalState = await getPendingApprovalState(runId)
            if (pendingApprovalState && pendingApprovalState.interruptions.length > 0) {
                let stepId: string | null = null
                for (const interruption of pendingApprovalState.interruptions) {
                    const callId = (interruption.rawItem as any)?.callId
                    if (callId) {
                        stepId = callId
                        break
                    }
                }

                if (stepId) {
                    logger.info("[agent:chat:message] Pending approval found; treating user message as rejection feedback", {
                        runId,
                        stepId,
                        userId
                    })

                    const approvalResult = await ApprovalService.processApproval({
                        runId,
                        stepId,
                        approved: false,
                        userId,
                        organizationId: organizationId ?? "",
                        rejectionReason: userMessage?.trim() || undefined
                    })

                    if (approvalResult.status === ApprovalProcessingStatus.FAILED) {
                        logger.error("[agent:chat:message] Failed to process implicit rejection from user chat message", {
                            runId,
                            stepId,
                            userId,
                            error: approvalResult.error
                        })
                    }

                    return
                }

                logger.warn("[agent:chat:message] Pending approval exists but no step id could be extracted", {
                    runId,
                    userId,
                    interruptionCount: pendingApprovalState.interruptions.length
                })

                // Fail-safe: do not continue into a fresh model run while a pending approval exists
                // but cannot be resolved to a stable step id.
                return
            }

            // Ensure run status is 'in_progress' so streaming works
            if (runRecord.status !== RunHistoryStatus.IN_PROGRESS) {
                await db().run_history_records.update({
                    where: { id: runId },
                    data: { status: RunHistoryStatus.IN_PROGRESS }
                })
            }
            if (organizationId) {
                emitCacheInvalidationWithWildcard(organizationId, "runHistory", agent.id)
            }

            const runContext: RunContext = { runId }
            const agentRunner = new AgentRunner(session, outputs, agent, runContext)

            let result
            try {
                result = await agentRunner.userMessageRun(userMessage, undefined, {
                    runId,
                    user: user,
                    agentId: agent.id
                })
            } catch (error) {
                const classified = classifyAgentError(error)
                logger.error(`[agent:chat:message] Error running agent: ${classified.message}`, { error, runId, agentId: agent.id, userId })
                await markRunFailedAndInvalidate(runId, classified, organizationId ?? undefined, agent.id)
                try {
                    await new NotificationManager(user, agent).notifyRunFailure(runId, classified.message)
                } catch (notificationError) {
                    logger.error("[agent:chat:message] Failed to send run failure notification", {
                        error: notificationError,
                        runId,
                        agentId: agent.id,
                        userId
                    })
                }
                return
            }

            // Finalize run status based on result, just like in EventProcessor
            if (result.status === AgentRunResultStatus.COMPLETED) {
                const completion = evaluateCompletedRun(result.result?.finalOutput, result.endedWithToolFailure)
                try {
                    await finalizeRunStatus(runId, completion.status)
                    if (organizationId) {
                        emitCacheInvalidationWithWildcard(organizationId, "runHistory", agent.id)
                    }
                    if (!completion.isSuccessful) {
                        try {
                            await new NotificationManager(user, agent).notifyRunFailure(runId, completion.failureReason)
                        } catch (notificationError) {
                            logger.error("[agent:chat:message] Failed to send run failure notification", {
                                error: notificationError,
                                runId,
                                agentId: agent.id,
                                userId
                            })
                        }
                    }
                } catch (e) {
                    logger.error("Failed to finalize run status", { error: e, runId })
                }
            }

            directiveTaskQueue.emit(new DirectiveTask(agent.id, runId, user, userMessage))
        })

        // Use centralized approval service - it handles Slack notifications internally
        socket.on(SocketEvents.AGENT_CHAT_APPROVAL, async (payload: { runId: string; message: ToolApprovalResponse }) => {
            const { runId, message } = payload
            logger.info(`[agent:chat:approval] Received approval response`, {
                message,
                userId,
                runId
            })

            if (!runId) {
                logger.error(`[agent:chat:approval] No runId provided`)
                return
            }

            const result = await ApprovalService.processApproval({
                runId,
                stepId: message.step_id,
                approved: message.approved,
                userId,
                organizationId: organizationId ?? ""
            })

            if (result.status === ApprovalProcessingStatus.FAILED && result.error) {
                logger.error(`[agent:chat:approval] Approval processing failed: ${result.error}`)
            } else {
                logger.info(`[agent:chat:approval] Successfully processed approval for runId: ${runId}`)
            }
        })

        // Listen for builder chat messages (in-app agent builder, organization-scoped)
        try {
            await registerBuilderChatHandler(socket, userId, organizationId ?? "")
        } catch (err) {
            logger.error("[builder:chat] Failed to register builder chat handler", { err, userId, organizationId })
        }

        // presence: mark online (60s TTL), refresh every 25s (only if Redis is available)
        if (pub) {
            const key = `presence:${userRoom}`
            pub.set(key, "1", { EX: 60 }).catch(() => {})
            const refresh = setInterval(() => pub!.expire(key, 60).catch(() => {}), 25_000)

            socket.on(SocketEvents.DISCONNECT, () => {
                clearInterval(refresh)
            })
        }
    })

    return io
}

export function getRealtimeSocket(): Server | null {
    return io
}

export function emitCacheInvalidationWithKey(organizationId: string, key: string) {
    if (!io) {
        logger.warn("Socket.IO server not initialized")
        return
    }
    io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.INVALIDATE, {
        key
    })
}

export function emitCacheInvalidationWithWildcard(organizationId: string, key: string, id: string) {
    if (!io) {
        logger.warn("Socket.IO server not initialized")
        return
    }
    io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.INVALIDATE, {
        key,
        id
    })
}

/**
 * Mark run as failed, append a raw error system event for model memory, emit a live RunError, and invalidate related caches.
 * Logs on failure; does not rethrow.
 */
export async function markRunFailedAndInvalidate(runId: string, classified: ClassifiedError, organizationId: string | undefined, agentId: string): Promise<void> {
    try {
        await markRunFailed(runId, classified.message, "agent")
        await appendRunHistoryErrorSystemEvent(runId, classified)

        if (io && organizationId) {
            const runErrorEvent = buildRunErrorEvent(classified)
            const runHistoryModelEvent: RunHistoryModelEvent = {
                ...runErrorEvent,
                id: `run-error-live-${randomString(15)}`,
                timestamp: Date.now()
            }
            const payload: RunHistoryModelSocketEvent = {
                runId,
                agentId,
                runHistoryModelEvent
            }
            io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
        }

        if (organizationId) {
            emitCacheInvalidationWithWildcard(organizationId, "runHistory", agentId)
            emitCacheInvalidationWithWildcard(organizationId, "chatHistory", runId)
        }
    } catch (e) {
        logger.error("Failed to mark run as failed and invalidate cache", { error: e, runId })
    }
}

function getSocketCorsOrigin(): boolean | string | string[] {
    const isProd = nodeEnv === "production"

    let socketCorsOrigin: boolean | string | string[]

    if (urls.socketFrontend) {
        socketCorsOrigin = [urls.socketFrontend]
    } else if (isProd) {
        logger.error("[Socket.IO] SOCKET_FRONTEND_URL (urls.socketFrontend) is not set in production. " + "Blocking all cross-origin Socket.IO connections for safety.")
        socketCorsOrigin = false // or throw if you prefer hard failure
    } else {
        // In dev, be permissive and echo back any origin
        socketCorsOrigin = true
    }

    return socketCorsOrigin
}

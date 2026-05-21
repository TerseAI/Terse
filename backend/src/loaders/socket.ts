import { createAdapter } from "@socket.io/redis-adapter"
import { Server as HttpServer } from "http"
import { createClient } from "redis"
import { Server, Socket } from "socket.io"
import { SendModelRequest, ToolApprovalResponse } from "terse-types"
import { type RunHistoryModelEvent, type RunHistoryModelSocketEvent, RunHistoryStatus } from "terse-types"
import { SocketEvents, SocketRooms } from "terse-types"
import { User } from "terse-types/types"

import { isCorsOriginAllowed } from "../common/corsOrigins"
import logger from "../common/logger"
import { getInputConfigInclude, getOutputConfigInclude } from "../common/prismaIncludes"
import { randomString } from "../common/strings"
import { SdkAgentRunner } from "../domains/agents/AgentRunner/SdkAgentRunner"
import { evaluateCompletedRun, finalizeRunStatus, getPendingApprovalState, markRunFailed, readSdkSkillsFromJson } from "../domains/agents/AgentRunner/runHistory"
import { type ClassifiedError, buildRunErrorEvent, classifyAgentError } from "../domains/agents/agentErrorUtils"
import { CancelReason, listenForRunCancellation, requestRunCancellation } from "../domains/agents/cancellation/RunCancellationTaskQueue"
import { markRunCancelledAndInvalidate } from "../domains/agents/cancellation/runCancellationEffects"
import { appendRunHistoryErrorSystemEvent } from "../domains/agents/systemEvents/runErrorSystemEvent"
import { NotificationManager } from "../domains/notifications/Notification"
import { getUserForOrg } from "../integrations/workos/helpers"
import { verifyWorkosJwt } from "../integrations/workos/jwt"
import { db } from "../loaders/prisma"
import { ApprovalProcessingStatus, ApprovalService } from "../services/ApprovalService"
import { billingServiceProxyForOrganization } from "../services/BillingService"
import { invalidateRunAndChatHistory } from "../services/CacheInvalidationService"
import { optional } from "../settings"
import { Agent, AgentWithRelations } from "../types/prisma"

// Extended Socket type with userId, organizationId, and WorkOS session ID
interface AuthenticatedSocket extends Socket {
    userId: string
    organizationId: string | undefined
    workosSessionId?: string // From JWT sid claim - used to target session-specific events
}

let io: Server | null = null
let pub: ReturnType<typeof createClient> | null = null
let sub: ReturnType<typeof createClient> | null = null

export async function initializeRealtimeSocket(server: HttpServer, corsAllowedOrigins: Set<string>): Promise<Server> {
    logger.info("Initializing realtime socket", {
        address: server.address()?.toString()
    })
    // Set up Socket.IO server
    io = new Server(server, {
        cors: {
            origin(origin, callback) {
                if (isCorsOriginAllowed(origin, corsAllowedOrigins)) {
                    callback(null, true)
                    return
                }
                logger.warn("Socket.IO CORS request blocked", { origin })
                callback(null, false)
            },
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
            const payload = await verifyWorkosJwt(token)

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

            const runRecord = await getAccessibleRunRecord(runId, organizationId)
            if (!runRecord) {
                logger.error(`[agent:chat:message] Run record not found for runId: ${runId} or user does not have access to this run`, { runId, userId, organizationId })
                return
            }
            const organizationIdForRun = runRecord.automation.organization_id
            const prisma = db()

            const agent: AgentWithRelations | null = await prisma.automations.findUnique({
                where: {
                    id: runRecord.automation.id,
                    organization_id: organizationIdForRun
                },
                include: {
                    prompt: true,
                    inputs: {
                        include: getInputConfigInclude()
                    },
                    outputs: {
                        include: getOutputConfigInclude()
                    },
                    tool_approvals: true,
                    project: true
                }
            })

            if (!agent) {
                logger.error(`[agent:chat:message] Agent not found for automation id: ${runRecord.automation.id}`, { automationId: runRecord.automation.id, userId })
                return
            }

            const user = await getUserForOrg(userId, organizationIdForRun)
            if (!user) {
                logger.error(`[agent:chat:message] User not found for userId: ${userId}`, { userId })
                return
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
                        organizationId: organizationIdForRun,
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

            // Ensure run status is 'in_progress' so streaming works.
            // Also clear has_approval_request since the approval cycle is over
            // (if there were an active pending_approval, we would have returned early above).
            if (runRecord.status !== RunHistoryStatus.IN_PROGRESS || runRecord.has_approval_request) {
                await db().run_history_records.update({
                    where: { id: runId },
                    data: { status: RunHistoryStatus.IN_PROGRESS, has_approval_request: false }
                })
            }
            invalidateRunAndChatHistory(organizationIdForRun, agent.id, runId)

            const cancellationController = new AbortController()
            const cancellationSubscription = listenForRunCancellation(runId, organizationIdForRun, cancellationController)
            const notificationManager = new NotificationManager(user, agent)

            let endedWithToolFailure = false
            let finalOutput: unknown = undefined

            const billing = billingServiceProxyForOrganization(user.organizationId, user.workosId)

            try {
                const skills = readSdkSkillsFromJson(runRecord.sdk_skills)

                const sdkRunner = new SdkAgentRunner({
                    runId,
                    user,
                    prompt: agent.prompt?.content ?? "",
                    skills,
                    // TODO: This probably isn't right. Idk how to handle tool approvals anymore for this use case. Need to think more about it.
                    toolApprovals: agent.tool_approvals.map((ta: any) => ta.tool_name),
                    maxTurns: 50,
                    requireApproval: true,
                    send: () => {},
                    isProductionRun: true,
                    billing
                })

                const sdkResult = await sdkRunner.userMessageRun(userMessage, {
                    signal: cancellationController.signal,
                    clientTurnId: message.client_turn_id
                })

                if (sdkResult.loopResult.status === "completed") {
                    endedWithToolFailure = sdkResult.loopResult.endedWithToolFailure || sdkRunner.hasToolFailures()
                    finalOutput = SdkAgentRunner.getFinalOutput(sdkResult.loopResult.result)
                }
            } catch (error) {
                const wasCancelledOnError = cancellationSubscription.isCancellationRequested()
                const reason = cancellationSubscription.getReason()
                cancellationSubscription.unsubscribe()

                if (wasCancelledOnError || (error instanceof Error && error.name === "AbortError")) {
                    await markRunCancelledAndInvalidate(runId, agent.id, organizationIdForRun, userId, reason)
                    return
                }

                const classified = classifyAgentError(error)
                logger.error(`[agent:chat:message] Error running agent: ${classified.message}`, { error, runId, agentId: agent.id, userId })
                await finalizeRunFailure(runId, classified, user, agent)
                return
            }

            const wasCancelled = cancellationSubscription.isCancellationRequested()
            const reason = cancellationSubscription.getReason()
            cancellationSubscription.unsubscribe()

            if (wasCancelled) {
                await markRunCancelledAndInvalidate(runId, agent.id, organizationIdForRun, userId, reason)
                return
            }

            // Finalize run status based on result
            const completion = evaluateCompletedRun(finalOutput, endedWithToolFailure)
            try {
                await finalizeRunStatus(runId, completion.status)
                invalidateRunAndChatHistory(organizationIdForRun, agent.id, runId)
                if (!completion.isSuccessful) {
                    await notifyRunFailure(notificationManager, runId, completion.failureReason, agent.id, userId)
                }
            } catch (e) {
                logger.error("Failed to finalize run status", { error: e, runId })
            }
        })

        socket.on(SocketEvents.AGENT_CHAT_CANCEL, async (payload: { runId: string | null }, ack: (response: CancelAckResponse) => void) => {
            const runId = payload?.runId?.trim()
            if (!runId) {
                ack({ accepted: false, reason: "missing_run_id" })
                return
            }

            const runRecord = await getAccessibleRunRecord(runId, organizationId)
            if (!runRecord) {
                ack({ accepted: false, reason: "run_not_found" })
                return
            }

            if (runRecord.status === RunHistoryStatus.AWAITING_APPROVAL) {
                await markRunCancelledAndInvalidate(runId, runRecord.automation.id, runRecord.automation.organization_id, userId, CancelReason.USER_CANCELLED)
                ack({ accepted: true })
                return
            }

            if (runRecord.status !== RunHistoryStatus.IN_PROGRESS) {
                ack({ accepted: false, reason: "no_active_run" })
                return
            }

            requestRunCancellation(runId, runRecord.automation.organization_id, CancelReason.USER_CANCELLED)
            ack({ accepted: true })
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
                stepId: message.id,
                approved: message.approved,
                rejectionReason: message.rejection_reason,
                userId,
                organizationId: organizationId ?? ""
            })

            if (result.status === ApprovalProcessingStatus.FAILED && result.error) {
                logger.error(`[agent:chat:approval] Approval processing failed: ${result.error}`)
            } else {
                logger.info(`[agent:chat:approval] Successfully processed approval for runId: ${runId}`)
            }
        })

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

async function notifyRunFailure(notificationManager: NotificationManager, runId: string, failureReason: string, agentId: string, userId: string): Promise<void> {
    try {
        await notificationManager.notifyRunFailure(runId, failureReason)
    } catch (notificationError) {
        logger.error("[agent:chat:message] Failed to send run failure notification", {
            error: notificationError,
            runId,
            agentId,
            userId
        })
    }
}

async function getAccessibleRunRecord(runId: string, organizationId: string | undefined) {
    if (!organizationId) {
        return null
    }

    const runRecord = await db().run_history_records.findUnique({
        where: { id: runId },
        include: { automation: true }
    })

    if (!runRecord || !runRecord.automation || runRecord.automation.organization_id !== organizationId) {
        return null
    }

    return runRecord
}

export async function finalizeRunFailure(runId: string, classified: ClassifiedError, user: User, agent: Agent): Promise<void> {
    const transitioned = await markRunFailedAndInvalidate(runId, classified, user.organizationId, agent.id)
    if (!transitioned) return
    try {
        await new NotificationManager(user, agent).notifyRunFailure(runId, classified.message)
    } catch (notificationError) {
        logger.error("Failed to send run failure notification", { error: notificationError, runId, agentId: agent.id })
    }
}

async function markRunFailedAndInvalidate(runId: string, classified: ClassifiedError, organizationId: string | undefined, agentId: string): Promise<boolean> {
    try {
        const transitioned = await markRunFailed(runId, classified.message, "agent")
        if (!transitioned) return false

        await appendRunHistoryErrorSystemEvent(runId, classified)

        if (io && organizationId) {
            const runErrorEvent = buildRunErrorEvent(classified)
            const runHistoryModelEvent: RunHistoryModelEvent = {
                ...runErrorEvent,
                id: `run-error-live-${randomString(15)}`
            }
            const payload: RunHistoryModelSocketEvent = {
                runId,
                agentId,
                runHistoryModelEvent
            }
            io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
        }

        if (organizationId) {
            invalidateRunAndChatHistory(organizationId, agentId, runId)
        }
        return true
    } catch (e) {
        logger.error("Failed to mark run as failed and invalidate cache", { error: e, runId })
        return false
    }
}

type CancelAckResponse = {
    accepted: boolean
    reason?: string
}

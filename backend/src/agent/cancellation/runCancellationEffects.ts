import logger from "../../logger"
import { emitCacheInvalidationWithWildcard, getSocketIO } from "../../services/CacheInvalidationService"
import { type RunHistoryModelEvent, type RunHistoryModelSocketEvent } from "../../shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "../../shared/SocketEvents"
import { randomString } from "../../utility/strings"
import { markRunCancelled } from "../AgentRunner/runHistory"
import { nextRunStreamSequence } from "../streamSequence"
import { createCancelledEvent } from "../streaming"
import { appendRunHistoryCancelledSystemEvent } from "../systemEvents/cancelledSystemEvent"

const USER_CANCELLED_REASON = "Run cancelled by user"

function invalidateRunAndChatHistory(organizationId: string, agentId: string, runId: string): void {
    emitCacheInvalidationWithWildcard(organizationId, "runHistory", agentId)
    emitCacheInvalidationWithWildcard(organizationId, "chatHistory", runId)
}

function emitCancelledForRun(runId: string, agentId: string, organizationId: string, reason?: string): void {
    const io = getSocketIO()
    if (!io) return

    const cancelledEvent = createCancelledEvent(reason)
    const runHistoryModelEvent: RunHistoryModelEvent = {
        ...cancelledEvent,
        id: `run-cancelled-live-${randomString(15)}`,
        stream_seq: nextRunStreamSequence(runId)
    }
    const payload: RunHistoryModelSocketEvent = {
        runId,
        agentId,
        runHistoryModelEvent
    }

    io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
}

export async function markRunCancelledAndInvalidate(runId: string, agentId: string, organizationId: string, userId: string, reason: string = USER_CANCELLED_REASON): Promise<void> {
    try {
        await markRunCancelled(runId, reason)
    } catch (cancelError) {
        logger.error("[agent:run:cancel] Failed to mark run as cancelled", {
            cancelError,
            runId,
            agentId,
            userId
        })
    }

    try {
        await appendRunHistoryCancelledSystemEvent(runId, reason)
    } catch (systemEventError) {
        logger.error("[agent:run:cancel] Failed to append cancelled system event", {
            systemEventError,
            runId,
            agentId,
            userId
        })
    }

    emitCancelledForRun(runId, agentId, organizationId, reason)
    invalidateRunAndChatHistory(organizationId, agentId, runId)
}

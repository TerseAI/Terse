import logger from "../../logger"
import { getSocketIO, invalidateRunAndChatHistory } from "../../services/CacheInvalidationService"
import { type RunHistoryModelEvent, type RunHistoryModelSocketEvent } from "../../shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "../../shared/SocketEvents"
import { USER_CANCELLED_REASON } from "../../socketHandlers/activeExecution"
import { randomString } from "../../utility/strings"
import { markRunCancelled } from "../AgentRunner/runHistory"
import { createCancelledEvent } from "../streaming"
import { appendRunHistoryCancelledSystemEvent } from "../systemEvents/cancelledSystemEvent"

function emitCancelledForRun(runId: string, agentId: string, organizationId: string, reason?: string): void {
    const io = getSocketIO()
    if (!io) return

    const cancelledEvent = createCancelledEvent(reason)
    const runHistoryModelEvent: RunHistoryModelEvent = {
        ...cancelledEvent,
        id: `run-cancelled-live-${randomString(15)}`
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

    try {
        emitCancelledForRun(runId, agentId, organizationId, reason)
    } catch (emitError) {
        logger.error("[agent:run:cancel] Failed to emit cancelled event", {
            emitError,
            runId,
            agentId,
            userId
        })
    }

    try {
        invalidateRunAndChatHistory(organizationId, agentId, runId)
    } catch (invalidateError) {
        logger.error("[agent:run:cancel] Failed to invalidate cache", {
            invalidateError,
            runId,
            agentId,
            userId
        })
    }
}

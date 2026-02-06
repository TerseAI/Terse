import { Server } from "socket.io"

import { buildRunErrorEvent, type ClassifiedError } from "../agentErrorUtils"
import logger from "../../logger"
import { SocketEvents, SocketRooms } from "../../shared/SocketEvents"

import { storeChatEvent } from "./runHistory"

export type ReportRunErrorToRunParams = {
    runId: string
    agentId: string
    organizationId: string
    classified: ClassifiedError
    io: Server | null
}

/**
 * Store a RunError event for the run and emit it to the org room so the run-history UI updates.
 * Catches and logs failures so callers do not need to try/catch.
 */
export async function reportRunErrorToRun(params: ReportRunErrorToRunParams): Promise<void> {
    const { runId, agentId, organizationId, classified, io } = params
    try {
        const event = buildRunErrorEvent(classified)
        const eventId = await storeChatEvent(runId, event)
        if (io && organizationId) {
            const payload = {
                runId,
                agentId,
                runHistoryModelEvent: {
                    ...event,
                    id: eventId,
                    timestamp: new Date().toISOString()
                }
            }
            io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
        }
    } catch (e) {
        logger.error("Failed to store or emit RunError", { error: e, runId })
    }
}

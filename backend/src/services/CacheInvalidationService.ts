import { Server } from "socket.io"

import logger from "../logger"
import { SocketEvents, SocketRooms } from "../shared/SocketEvents"

type SocketGetter = () => Server | null
let getSocket: SocketGetter | null = null

export function registerSocketGetter(getter: SocketGetter): void {
    getSocket = getter
}

export function getSocketIO(): Server | null {
    return getSocket?.() ?? null
}

export function emitCacheInvalidationWithKey(organizationId: string, key: string): void {
    const io = getSocket?.()
    if (!io) {
        logger.warn("Socket.IO server not initialized")
        return
    }
    io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.INVALIDATE, { key })
}

export function emitCacheInvalidationWithWildcard(organizationId: string, key: string, id: string): void {
    const io = getSocket?.()
    if (!io) {
        logger.warn("Socket.IO server not initialized")
        return
    }
    // Send tag-based invalidation payload
    // If id is provided, frontend will match on both tag and id
    // If id is not provided, frontend will match on tag only
    io.to(SocketRooms.organization(organizationId)).emit(SocketEvents.INVALIDATE, { key, id })
}

export function invalidateRunAndChatHistory(organizationId: string, agentId: string, runId: string): void {
    emitCacheInvalidationWithWildcard(organizationId, "runHistory", agentId)
    emitCacheInvalidationWithWildcard(organizationId, "chatHistory", runId)
}

import { Server } from "socket.io"
import { billingBalanceKey, billingUsageKey } from "terse-types/InvalidationKeys"
import { SocketEvents, SocketRooms } from "terse-types/SocketEvents"

import logger from "../logger"

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

/** Frontend SWR tags — emitted after meter/consumption changes so billing UI refreshes for the org. */
export function emitBillingCachesInvalidated(organizationId: string): void {
    emitCacheInvalidationWithKey(organizationId, billingBalanceKey()[0])
    emitCacheInvalidationWithKey(organizationId, billingUsageKey()[0])
}

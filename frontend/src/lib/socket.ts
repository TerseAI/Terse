import { Socket, io } from "socket.io-client"
import { mutate } from "swr"
import { currentUserKey, userOrganizationsKey, widgetTokenKey } from "terse-types"
import { ModelEvent, ModelRequest } from "terse-types"
import type { RunHistoryModelSocketEvent } from "terse-types"
import { SocketEvents } from "terse-types"

import { BackendProvider } from "@/lib/http"
import { emitAuthEvent } from "@/modules/auth/utils/authEvents"

let socket: Socket | null = null

// Callback types (defined early for pending subscription types)
type ChatEventCallback = (payload: RunHistoryModelSocketEvent) => void
type CancelAckResponse = { accepted: boolean; reason?: string }

// Pending subscriptions queue for handling race conditions
type PendingChatSubscription = {
    type: "chat"
    runId: string
    callback: ChatEventCallback
}

type PendingSubscription = PendingChatSubscription

const pendingSubscriptions: PendingSubscription[] = []

// Callback storage
const chatEventCallbacks = new Map<string, Set<ChatEventCallback>>()
let chatEventListenerSetUp = false

function shouldInvalidateRunStatusCaches(event: ModelEvent): boolean {
    return event.type === "ToolApprovalRequest" || event.type === "ToolApprovalResponse" || event.type === "Cancelled" || event.type === "RunError" || event.type === "NaturalStop"
}

function invalidateRunStatusCaches(runId: string, agentId: string): void {
    void mutate(key => Array.isArray(key) && ((key[0] === "chatHistory" && key[1] === runId) || (key[0] === "runHistory" && key[1] === agentId) || key[0] === "allRunHistory"))
}

function setupChatEventListener() {
    if (!socket || chatEventListenerSetUp) {
        return
    }

    socket.on(SocketEvents.AGENT_CHAT_EVENT, (payload: RunHistoryModelSocketEvent) => {
        const callbacks = chatEventCallbacks.get(payload.runId)
        if (callbacks) {
            callbacks.forEach(cb => cb(payload))
        }
        if (shouldInvalidateRunStatusCaches(payload.runHistoryModelEvent)) {
            invalidateRunStatusCaches(payload.runId, payload.agentId)
        }
    })

    chatEventListenerSetUp = true
}

function addChatSubscription(runId: string, callback: ChatEventCallback) {
    setupChatEventListener()
    if (!chatEventCallbacks.has(runId)) {
        chatEventCallbacks.set(runId, new Set())
    }
    chatEventCallbacks.get(runId)!.add(callback)
}

function processPendingSubscriptions() {
    if (pendingSubscriptions.length === 0) return

    for (const sub of pendingSubscriptions) {
        addChatSubscription(sub.runId, sub.callback)
    }

    // Clear the queue
    pendingSubscriptions.length = 0
}

export function initializeSocket() {
    // Don't initialize if socket exists - Socket.IO handles reconnection automatically
    if (socket) {
        return
    }

    const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL
    const socketUrl = configuredSocketUrl ?? window.location.origin
    const isSameOriginSocket = !configuredSocketUrl || new URL(configuredSocketUrl, window.location.origin).origin === window.location.origin
    const socketBasePath = isSameOriginSocket ? (import.meta.env.VITE_WS_BASE ?? "/api") : ""
    const socketPath = `${socketBasePath}/socket.io`

    // Socket is assigned synchronously here to prevent race conditions
    // The auth callback fetches a fresh token on every connection/reconnection attempt
    socket = io(socketUrl, {
        path: socketPath,
        auth: async cb => {
            try {
                const token = await BackendProvider.requestSessionSocketToken()
                cb({ token })
            } catch {
                cb({ token: null })
            }
        },
        withCredentials: true
    })

    socket.on(SocketEvents.CONNECT, () => {
        processPendingSubscriptions()
    })

    // Listen for cache invalidation events
    socket.on(SocketEvents.INVALIDATE, (payload: { key?: string; id?: string }) => {
        const { key, id } = payload || {}
        if (key && id) {
            // Match keys where k[1] is either the id directly OR an object containing { id }
            mutate(k => {
                if (!Array.isArray(k) || k[0] !== key) return false
                const secondElement = k[1]
                // Direct match (e.g., ['runHistory', agentId])
                if (secondElement === id) return true
                // Object with id property (e.g., ['agent', { id: agentId }])
                if (typeof secondElement === "object" && secondElement !== null && "id" in secondElement && secondElement.id === id) {
                    return true
                }
                return false
            })
            if (key === "runHistory") {
                mutate(k => Array.isArray(k) && k[0] === "allRunHistory")
            }
        } else if (key) {
            mutate(k => Array.isArray(k) && k[0] === key)
        }
    })

    // WorkOS webhook-driven events
    socket.on(SocketEvents.WORKOS_FORCE_LOGOUT, () => {
        emitAuthEvent("logout")
        void BackendProvider.logoutRedirect()
    })

    socket.on(SocketEvents.WORKOS_USER_UPDATED, () => {
        void mutate(widgetTokenKey())
        void mutate(currentUserKey())
    })

    socket.on(SocketEvents.WORKOS_SESSION_UPDATED, () => {
        void mutate(widgetTokenKey())
    })

    socket.on(SocketEvents.WORKOS_ORG_UPDATED, () => {
        void mutate(widgetTokenKey())
        void mutate(userOrganizationsKey())
        void mutate(currentUserKey())
    })
}

// Chat event subscription
export function subscribeToChatEvents(runId: string, callback: ChatEventCallback): () => void {
    if (socket?.connected) {
        addChatSubscription(runId, callback)
    } else {
        pendingSubscriptions.push({ type: "chat", runId, callback })
    }

    return () => {
        const pendingIndex = pendingSubscriptions.findIndex(sub => sub.type === "chat" && sub.runId === runId && sub.callback === callback)
        if (pendingIndex !== -1) {
            pendingSubscriptions.splice(pendingIndex, 1)
        }

        const callbacks = chatEventCallbacks.get(runId)
        if (callbacks) {
            callbacks.delete(callback)
            if (callbacks.size === 0) {
                chatEventCallbacks.delete(runId)
            }
        }
    }
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect()
        socket = null
    }
    // explicit clear of callbacks and pending subscriptions
    // avoiding a memory leak
    chatEventCallbacks.clear()
    pendingSubscriptions.length = 0
    chatEventListenerSetUp = false
}

export function sendChatMessage(runId: string | null, message: ModelRequest): void {
    if (!socket || !socket.connected) {
        return
    }
    socket.emit(SocketEvents.AGENT_CHAT_MESSAGE, { runId, message })
}

export type ToolApprovalResponseOptions = {
    rejectionReason?: string
    responseId?: string
}

export function sendToolApprovalResponse(runId: string, stepId: string, approved: boolean, options?: ToolApprovalResponseOptions): void {
    if (!socket || !socket.connected) {
        return
    }
    socket.emit(SocketEvents.AGENT_CHAT_APPROVAL, {
        runId,
        message: {
            type: "ToolApprovalResponse",
            id: stepId,
            response_id: options?.responseId ?? stepId,
            timestamp: Date.now(),
            approved,
            rejection_reason: options?.rejectionReason
        }
    })
}

export async function cancelAgentChatRun(runId: string): Promise<CancelAckResponse> {
    const activeSocket = socket
    if (!activeSocket || !activeSocket.connected) {
        return { accepted: false, reason: "socket_not_connected" }
    }

    return await new Promise(resolve => {
        activeSocket.timeout(5000).emit(SocketEvents.AGENT_CHAT_CANCEL, { runId }, (err: Error | null, response?: CancelAckResponse) => {
            if (err) {
                resolve({ accepted: false, reason: "timeout" })
                return
            }
            resolve(response ?? { accepted: false, reason: "no_response" })
        })
    })
}

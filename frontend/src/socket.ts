import { io, Socket } from "socket.io-client";
import { mutate } from "swr";
import { BackendProvider } from "./services/backend";
import {
  currentUserKey,
  userOrganizationsKey,
  widgetTokenKey,
} from "./shared/InvalidationKeys";
import { ApiRoutes } from "./shared/ApiRoutes";
import { ModelEvent, ModelRequest } from "./shared/ModelEvents";
import type { RunHistoryModelSocketEvent } from "./shared/RunHistoryTypes";
import { SocketEvents } from "./shared/SocketEvents";

const backendRedirectUrl = import.meta.env.VITE_BACKEND_REDIRECT_URL || "/api";

let socket: Socket | null = null;

// Callback types (defined early for pending subscription types)
type ChatEventCallback = (payload: RunHistoryModelSocketEvent) => void;
type BuilderEventPayload = { sessionId: string; event: ModelEvent };
type BuilderEventCallback = (payload: BuilderEventPayload) => void;

// Pending subscriptions queue for handling race conditions
type PendingChatSubscription = {
  type: "chat";
  runId: string;
  callback: ChatEventCallback;
};

type PendingBuilderSubscription = {
  type: "builder";
  sessionId: string;
  callback: BuilderEventCallback;
};

type PendingSubscription = PendingChatSubscription | PendingBuilderSubscription;

const pendingSubscriptions: PendingSubscription[] = [];

// Callback storage
const chatEventCallbacks = new Map<string, Set<ChatEventCallback>>();
const builderEventCallbacks = new Map<string, Set<BuilderEventCallback>>();
let chatEventListenerSetUp = false;
let builderEventListenerSetUp = false;

function setupChatEventListener() {
  if (!socket || chatEventListenerSetUp) {
    return;
  }

  socket.on(
    SocketEvents.AGENT_CHAT_EVENT,
    (payload: RunHistoryModelSocketEvent) => {
      const callbacks = chatEventCallbacks.get(payload.runId);
      if (callbacks) {
        callbacks.forEach((cb) => cb(payload));
      }
    },
  );

  chatEventListenerSetUp = true;
}

function setupBuilderEventListener() {
  if (!socket || builderEventListenerSetUp) {
    return;
  }

  socket.on(SocketEvents.BUILDER_CHAT_EVENT, (payload: BuilderEventPayload) => {
    const callbacks = builderEventCallbacks.get(payload.sessionId);
    if (callbacks) {
      callbacks.forEach((cb) => cb(payload));
    }
  });

  builderEventListenerSetUp = true;
}

function addChatSubscription(runId: string, callback: ChatEventCallback) {
  setupChatEventListener();
  if (!chatEventCallbacks.has(runId)) {
    chatEventCallbacks.set(runId, new Set());
  }
  chatEventCallbacks.get(runId)!.add(callback);
}

function addBuilderSubscription(
  sessionId: string,
  callback: BuilderEventCallback,
) {
  setupBuilderEventListener();
  if (!builderEventCallbacks.has(sessionId)) {
    builderEventCallbacks.set(sessionId, new Set());
  }
  builderEventCallbacks.get(sessionId)!.add(callback);
}

function processPendingSubscriptions() {
  if (pendingSubscriptions.length === 0) return;

  console.log(
    `Processing ${pendingSubscriptions.length} pending socket subscriptions`,
  );

  for (const sub of pendingSubscriptions) {
    if (sub.type === "chat") {
      addChatSubscription(sub.runId, sub.callback);
    } else if (sub.type === "builder") {
      addBuilderSubscription(sub.sessionId, sub.callback);
    }
  }

  // Clear the queue
  pendingSubscriptions.length = 0;
}

export async function initializeSocket() {
  // Don't initialize if already connected
  if (socket?.connected) {
    return;
  }

  // Get the session token for authentication
  const token = await BackendProvider.requestSessionSocketToken();

  // Socket.IO needs the full origin URL, and we specify the path via the 'path' option
  // The path will be: /api/socket.io (which the Vite proxy will forward to /socket.io on backend)
  const socketUrl = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

  socket = io(socketUrl, {
    auth: { token },
    withCredentials: true,
  });

  socket.on(SocketEvents.CONNECT_ERROR, (error) => {
    console.error("Socket.IO connection error:", error);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
  });

  socket.on(SocketEvents.CONNECT, () => {
    console.log("Socket.IO connected");
    processPendingSubscriptions();
  });

  // Listen for cache invalidation events
  socket.on(
    SocketEvents.INVALIDATE,
    (payload: { key?: string; id?: string }) => {
      const { key, id } = payload || {};
      if (key && id) {
        mutate((k) => Array.isArray(k) && k[0] === key && k[1] === id);
      } else if (key) {
        mutate((k) => Array.isArray(k) && k[0] === key);
      }
    },
  );

  // WorkOS webhook-driven events
  socket.on(SocketEvents.WORKOS_FORCE_LOGOUT, () => {
    window.location.href = `${backendRedirectUrl}${ApiRoutes.AUTH.LOGIN}`;
  });

  socket.on(SocketEvents.WORKOS_USER_UPDATED, () => {
    void mutate(widgetTokenKey());
    void mutate(currentUserKey());
  });

  socket.on(SocketEvents.WORKOS_SESSION_UPDATED, () => {
    void mutate(widgetTokenKey());
  });

  socket.on(SocketEvents.WORKOS_ORG_UPDATED, () => {
    void mutate(widgetTokenKey());
    void mutate(userOrganizationsKey());
    void mutate(currentUserKey());
  });
}

// Chat event subscription
export function subscribeToChatEvents(
  runId: string,
  callback: ChatEventCallback,
): () => void {
  if (socket?.connected) {
    addChatSubscription(runId, callback);
  } else {
    console.log(
      "Socket not ready, queueing chat subscription for runId:",
      runId,
    );
    pendingSubscriptions.push({ type: "chat", runId, callback });
  }

  return () => {
    const pendingIndex = pendingSubscriptions.findIndex(
      (sub) =>
        sub.type === "chat" && sub.runId === runId && sub.callback === callback,
    );
    if (pendingIndex !== -1) {
      pendingSubscriptions.splice(pendingIndex, 1);
    }

    const callbacks = chatEventCallbacks.get(runId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        chatEventCallbacks.delete(runId);
      }
    }
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  chatEventListenerSetUp = false;
  builderEventListenerSetUp = false;
}

export function sendChatMessage(
  runId: string | null,
  message: ModelRequest,
): void {
  if (!socket || !socket.connected) {
    console.warn("Socket not connected, cannot send message");
    return;
  }
  socket.emit(SocketEvents.AGENT_CHAT_MESSAGE, { runId, message });
}

export function sendToolApprovalResponse(
  runId: string,
  stepId: string,
  approved: boolean,
): void {
  if (!socket || !socket.connected) {
    console.warn("Socket not connected, cannot send approval response");
    return;
  }
  socket.emit(SocketEvents.AGENT_CHAT_APPROVAL, {
    runId,
    message: {
      type: "ToolApprovalResponse",
      step_id: stepId,
      approved,
    },
  });
}

// Builder chat subscription
export function subscribeToBuilderChat(
  sessionId: string,
  callback: BuilderEventCallback,
): () => void {
  // If socket is connected, subscribe immediately
  if (socket?.connected) {
    addBuilderSubscription(sessionId, callback);
  } else {
    // Queue for when socket connects
    console.log(
      "Socket not ready, queueing builder subscription for sessionId:",
      sessionId,
    );
    pendingSubscriptions.push({ type: "builder", sessionId, callback });
  }

  // Return unsubscribe function (works regardless of connection state)
  return () => {
    // Remove from pending queue if still there
    const pendingIndex = pendingSubscriptions.findIndex(
      (sub) =>
        sub.type === "builder" &&
        sub.sessionId === sessionId &&
        sub.callback === callback,
    );
    if (pendingIndex !== -1) {
      pendingSubscriptions.splice(pendingIndex, 1);
    }

    // Remove from active callbacks
    const callbacks = builderEventCallbacks.get(sessionId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        builderEventCallbacks.delete(sessionId);
      }
    }
  };
}

export function sendBuilderMessage(
  sessionId: string,
  message: ModelRequest,
): void {
  if (!socket || !socket.connected) {
    console.warn("Socket not connected, cannot send builder message");
    return;
  }
  socket.emit(SocketEvents.BUILDER_CHAT_MESSAGE, { sessionId, message });
}

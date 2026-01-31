import { io, Socket } from "socket.io-client";
import { mutate } from "swr";
import { BackendProvider } from "./services/backend";
import { ApiRoutes } from "./shared/ApiRoutes";
import { ModelRequest } from "./shared/ModelEvents";
import type { RunHistoryModelSocketEvent } from "./shared/RunHistoryTypes";
import { SocketEvents } from "./shared/SocketEvents";

const backendRedirectUrl = import.meta.env.VITE_BACKEND_REDIRECT_URL || "/api";

let socket: Socket | null = null;

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

  // Listen for cache invalidation events
  // SWR keys are tuples like ['runHistory', automationId, params] or ['automations', params]
  // keys: array of serialized SWR keys (JSON strings that can be parsed back to tuples)
  // tag: prefix to match against the first element of tuple keys (e.g., 'runHistory' matches ['runHistory', ...])
  // id: optional second element to match (e.g., automationId for runHistory queries)
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
    window.dispatchEvent(new CustomEvent(SocketEvents.WORKOS_USER_UPDATED));
  });

  socket.on(SocketEvents.WORKOS_SESSION_UPDATED, () => {
    window.dispatchEvent(new CustomEvent(SocketEvents.WORKOS_SESSION_UPDATED));
  });

  socket.on(SocketEvents.WORKOS_ORG_UPDATED, () => {
    window.dispatchEvent(new CustomEvent(SocketEvents.WORKOS_ORG_UPDATED));
  });
}

// Chat event subscription management
type ChatEventCallback = (payload: RunHistoryModelSocketEvent) => void;

const chatEventCallbacks = new Map<string, Set<ChatEventCallback>>();
let chatEventListenerSetUp = false;

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

export function subscribeToChatEvents(
  runId: string,
  callback: ChatEventCallback,
): () => void {
  if (!socket) {
    console.warn("Socket not initialized, cannot subscribe to chat events");
    return () => {};
  }

  // Set up the listener if not already done
  setupChatEventListener();

  if (!chatEventCallbacks.has(runId)) {
    chatEventCallbacks.set(runId, new Set());
  }

  chatEventCallbacks.get(runId)!.add(callback);

  // Return unsubscribe function
  return () => {
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

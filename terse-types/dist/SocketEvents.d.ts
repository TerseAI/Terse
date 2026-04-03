/**
 * Socket event name constants for Socket.IO communication
 *
 * These constants standardize socket event names across frontend and backend,
 * preventing magic strings and making refactoring easier.
 */
export declare const SocketEvents: {
    readonly CONNECT: "connect";
    readonly DISCONNECT: "disconnect";
    readonly CONNECT_ERROR: "connect_error";
    readonly INVALIDATE: "invalidate";
    readonly AGENT_CHAT_EVENT: "agent:chat:event";
    readonly AGENT_CHAT_MESSAGE: "agent:chat:message";
    readonly AGENT_CHAT_APPROVAL: "agent:chat:approval";
    readonly AGENT_CHAT_CANCEL: "agent:chat:cancel";
    readonly WORKOS_USER_UPDATED: "workos:user:updated";
    readonly WORKOS_FORCE_LOGOUT: "workos:force:logout";
    readonly WORKOS_SESSION_UPDATED: "workos:session:updated";
    readonly WORKOS_ORG_UPDATED: "workos:org:updated";
    readonly BUILDER_CHAT_EVENT: "builder:chat:event";
    readonly BUILDER_CHAT_MESSAGE: "builder:chat:message";
    readonly BUILDER_CHAT_CANCEL: "builder:chat:cancel";
    readonly BUILDER_CHAT_APPROVAL: "builder:chat:approval";
    readonly BUILDER_CHAT_MULTIPLE_CHOICE_ANSWER: "builder:chat:multiple_choice_answer";
};
/**
 * Socket room name patterns and helpers
 */
export declare const SocketRooms: {
    /**
     * Get the room name for a specific user
     * @param userId - The user ID
     * @returns Room name in format "user:${userId}"
     */
    readonly user: (userId: string) => string;
    /**
     * Get the room name for a specific organization
     * @param orgId - The organization ID
     * @returns Room name in format "org:${orgId}"
     */
    readonly organization: (orgId: string) => string;
    /**
     * Get the room name for a specific WorkOS session (for targeting a single device)
     * @param workosSessionId - The WorkOS session ID (from JWT sid claim)
     * @returns Room name in format "session:${workosSessionId}"
     */
    readonly session: (workosSessionId: string) => string;
};

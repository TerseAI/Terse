/**
 * Socket event name constants for Socket.IO communication
 * 
 * These constants standardize socket event names across frontend and backend,
 * preventing magic strings and making refactoring easier.
 */

export const SocketEvents = {
  // Built-in Socket.IO events (documented for reference)
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  
  // Custom events
  INVALIDATE: 'invalidate',
  AGENT_CHAT_EVENT: 'agent:chat:event',
  AGENT_CHAT_MESSAGE: 'agent:chat:message',
  AGENT_CHAT_APPROVAL: 'agent:chat:approval',

  // WorkOS user events
  WORKOS_USER_UPDATED: 'workos:user:updated',
  WORKOS_FORCE_LOGOUT: 'workos:force:logout',
  WORKOS_SESSION_UPDATED: 'workos:session:updated',
  WORKOS_ORG_UPDATED: 'workos:org:updated',

  // Builder chat events
  BUILDER_CHAT_EVENT: 'builder:chat:event',
  BUILDER_CHAT_MESSAGE: 'builder:chat:message',
  BUILDER_CHAT_APPROVAL: 'builder:chat:approval',
} as const;

/**
 * Socket room name patterns and helpers
 */
export const SocketRooms = {
  /**
   * Get the room name for a specific user
   * @param userId - The user ID
   * @returns Room name in format "user:${userId}"
   */
  user: (userId: string): string => `user:${userId}`,
  /**
   * Get the room name for a specific organization
   * @param orgId - The organization ID
   * @returns Room name in format "org:${orgId}"
   */
  organization: (orgId: string): string => `org:${orgId}`,
  /**
   * Get the room name for a specific WorkOS session (for targeting a single device)
   * @param workosSessionId - The WorkOS session ID (from JWT sid claim)
   * @returns Room name in format "session:${workosSessionId}"
   */
  session: (workosSessionId: string): string => `session:${workosSessionId}`,
} as const;

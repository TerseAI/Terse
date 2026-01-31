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
} as const;

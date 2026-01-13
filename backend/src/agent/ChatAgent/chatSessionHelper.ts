import { db } from '../../prismaClient';
import { Prisma, ChatSessionType } from '@prisma/client';

/**
 * Gets or creates a chat session by external ID and session type.
 * Returns the chat session ID.
 */
export async function getOrCreateChatSession(
  sessionType: ChatSessionType,
  externalId: string,
  userId?: string,
  metadata?: Prisma.InputJsonValue
): Promise<string> {
  const prisma = db();

  // Try to find existing session
  const existingSession = await prisma.chat_sessions.findFirst({
    where: {
      session_type: sessionType,
      external_id: externalId,
    },
    select: {
      id: true,
    },
  });

  if (existingSession) {
    return existingSession.id;
  }

  // Create new session if it doesn't exist
  const newSession = await prisma.chat_sessions.create({
    data: {
      session_type: sessionType,
      external_id: externalId,
      user_id: userId ?? null,
      ...(metadata !== undefined && { metadata }),
    },
    select: {
      id: true,
    },
  });

  return newSession.id;
}

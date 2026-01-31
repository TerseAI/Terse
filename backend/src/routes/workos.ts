import { Request, Response } from "express";
import { settings } from "../config/settings";
import logger from "../logger";
import { db } from "../prismaClient";
import { getRealtimeSocket } from "../realtimeSocket";
import { SocketEvents, SocketRooms } from "../shared/SocketEvents";
import { workos } from "./auth";

/**
 * WorkOS webhook event payload structure.
 * See https://workos.com/docs/events/data-syncing/webhooks
 */
interface WorkOSWebhookEvent {
  id: string;
  event: string;
  data: {
    object: string;
    id: string;
    [key: string]: unknown;
  };
}

/**
 * Map WorkOS user ID to local database user ID.
 * Returns null if user not found in our database.
 */
async function getLocalUserIdFromWorkOS(
  workosUserId: string,
): Promise<string | null> {
  const prisma = db();
  const user = await prisma.users.findUnique({
    where: { workos_id: workosUserId },
  });
  return user?.id ?? null;
}

/**
 * Process a validated WorkOS webhook event and emit socket events.
 */
async function processWorkOSEvent(event: WorkOSWebhookEvent): Promise<void> {
  const io = getRealtimeSocket();
  if (!io) {
    logger.warn("Socket.IO not initialized, cannot emit WorkOS webhook events");
    return;
  }

  const { event: eventType, data } = event;

  switch (eventType) {
    case "user.updated": {
      // WorkOS User Management puts user at top level: data.id, data.email, etc.
      const workosUserId =
        (data as { user?: { id: string } }).user?.id ??
        (data as { id?: string }).id;
      if (!workosUserId) {
        logger.warn("[WorkOS webhook] user.updated: no user id in payload", {
          data: JSON.stringify(data),
        });
        break;
      }
      const localUserId = await getLocalUserIdFromWorkOS(workosUserId);
      const room = SocketRooms.user(localUserId ?? "");
      if (!localUserId) {
        logger.warn(
          "[WorkOS webhook] user.updated: no local user found for workos user",
          { workosUserId },
        );
        break;
      }
      io.to(room).emit(SocketEvents.WORKOS_USER_UPDATED, {
        userId: localUserId,
      });
      break;
    }

    case "user.deleted": {
      const workosUserId = (data as { user?: { id: string } }).user?.id;
      if (!workosUserId) break;
      const localUserId = await getLocalUserIdFromWorkOS(workosUserId);
      if (localUserId) {
        io.to(SocketRooms.user(localUserId)).emit(
          SocketEvents.WORKOS_FORCE_LOGOUT,
          {
            reason: "user_deleted",
          },
        );
      }
      break;
    }

    case "session.revoked": {
      // WorkOS puts session fields at top level: data.id (session id), data.userId, etc.
      // Emit ONLY to the session room - so only the device with that session gets logged out.
      // Revoking "Chrome on Mac" should not log out "Safari on iPhone".
      const revokedSessionId = (data as { id?: string }).id;
      if (!revokedSessionId) {
        logger.warn(
          "[WorkOS webhook] session.revoked: no session id in payload",
          { data: JSON.stringify(data) },
        );
        break;
      }
      const sessionRoom = SocketRooms.session(revokedSessionId);
      io.to(sessionRoom).emit(SocketEvents.WORKOS_FORCE_LOGOUT, {
        reason: "session_revoked",
      });
      break;
    }

    case "session.created": {
      const workosUserId =
        (data as { userId?: string }).userId ??
        (data as { session?: { user_id: string } }).session?.user_id;
      if (!workosUserId) break;
      const localUserId = await getLocalUserIdFromWorkOS(workosUserId);
      if (localUserId) {
        io.to(SocketRooms.user(localUserId)).emit(
          SocketEvents.WORKOS_SESSION_UPDATED,
          {
            userId: localUserId,
          },
        );
      }
      break;
    }

    case "organization.updated":
    case "organization_membership.created":
    case "organization_membership.deleted":
    case "organization_membership.updated": {
      const orgId =
        (data as { organization?: { id: string }; organization_id?: string })
          .organization?.id ??
        (data as { organization_id?: string }).organization_id;
      if (orgId) {
        io.to(SocketRooms.organization(orgId)).emit(
          SocketEvents.WORKOS_ORG_UPDATED,
          {
            organizationId: orgId,
          },
        );
      }
      const workosUserId =
        (data as { user?: { id: string }; user_id?: string }).user?.id ??
        (data as { user_id?: string }).user_id;
      if (workosUserId) {
        const localUserId = await getLocalUserIdFromWorkOS(workosUserId);
        if (localUserId) {
          io.to(SocketRooms.user(localUserId)).emit(
            SocketEvents.WORKOS_USER_UPDATED,
            {
              userId: localUserId,
            },
          );
        }
      }
      break;
    }

    default:
      logger.debug("Unhandled WorkOS webhook event", { eventType });
  }
}

/**
 * Handle incoming WorkOS webhooks.
 * Validates signature, responds 200 immediately, processes events asynchronously.
 */
export async function handleWorkOSWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const webhookSecret = settings.workos.webhookSecret;
  if (!webhookSecret) {
    logger.error("WORKOS_WEBHOOK_SECRET not configured");
    res.status(500).send("Webhook not configured");
    return;
  }

  const rawBody = req.body as Buffer;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    logger.error("WorkOS webhook: missing or invalid raw body");
    res.status(400).send("Bad Request");
    return;
  }

  const sigHeader =
    req.get("workos-signature") ?? req.get("WorkOS-Signature") ?? "";
  if (!sigHeader) {
    logger.error("WorkOS webhook: missing WorkOS-Signature header");
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<
      string,
      unknown
    >;
    const event = await workos.webhooks.constructEvent({
      payload,
      sigHeader,
      secret: webhookSecret,
    });

    const webhookEvent = event as WorkOSWebhookEvent;

    // Respond immediately per WorkOS best practices
    res.status(200).send("OK");

    // Process asynchronously
    processWorkOSEvent(webhookEvent).catch((err) => {
      logger.error("Error processing WorkOS webhook event", {
        error: err,
        eventId: webhookEvent.id,
      });
    });
  } catch (error) {
    logger.error("WorkOS webhook signature verification failed", { error });
    res.status(401).send("Unauthorized");
  }
}

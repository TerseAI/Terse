import type { Event as WorkOSEvent } from "@workos-inc/node"
import { Request, Response } from "express"
import { SocketEvents, SocketRooms } from "terse-types/SocketEvents"

import logger from "../../common/logger"
import { workos } from "../../integrations/workos/helpers"
import { db } from "../../loaders/prisma"
import { getRealtimeSocket } from "../../loaders/socket"
import { emitBillingCachesInvalidated } from "../../services/CacheInvalidationService"
import { settings } from "../../settings"
import { cleanupIdentity } from "../../utility/identity"

/**
 * Process a validated WorkOS webhook event and emit socket events.
 */
async function processWorkOSEvent(event: WorkOSEvent): Promise<void> {
    const io = getRealtimeSocket()
    if (!io) {
        logger.warn("Socket.IO not initialized, cannot emit WorkOS webhook events")
        return
    }

    const { event: eventType, data } = event

    switch (eventType) {
        case "user.created": {
            const workosUserId = data.id
            if (!workosUserId) {
                logger.warn("[WorkOS webhook] user.created: no user id in payload", { data: JSON.stringify(data) })
                break
            }
            await ensureDefaultNotificationSettings(workosUserId)
            break
        }

        case "user.updated": {
            const workosUserId = data.id
            if (!workosUserId) {
                logger.warn("[WorkOS webhook] user.updated: no user id in payload", { data: JSON.stringify(data) })
                break
            }
            io.to(SocketRooms.user(workosUserId)).emit(SocketEvents.WORKOS_USER_UPDATED, {
                userId: workosUserId
            })
            break
        }

        case "user.deleted": {
            const workosUserId = data.id
            if (!workosUserId) break
            io.to(SocketRooms.user(workosUserId)).emit(SocketEvents.WORKOS_FORCE_LOGOUT, {
                reason: "user_deleted"
            })
            try {
                await cleanupIdentity(workosUserId)
            } catch (error) {
                logger.error("[WorkOS webhook] user.deleted: cleanupIdentity failed", { workosUserId, error })
            }
            break
        }

        case "session.revoked": {
            // Emit ONLY to the session room - so only the device with that session gets logged out.
            // Revoking "Chrome on Mac" should not log out "Safari on iPhone".
            const revokedSessionId = data.id
            if (!revokedSessionId) {
                logger.warn("[WorkOS webhook] session.revoked: no session id in payload")
                break
            }
            io.to(SocketRooms.session(revokedSessionId)).emit(SocketEvents.WORKOS_FORCE_LOGOUT, {
                reason: "session_revoked"
            })
            break
        }

        case "session.created": {
            const workosUserId = data.userId
            if (!workosUserId) break
            io.to(SocketRooms.user(workosUserId)).emit(SocketEvents.WORKOS_SESSION_UPDATED, {
                userId: workosUserId
            })
            break
        }

        case "organization.updated":
        case "organization_membership.created":
        case "organization_membership.deleted":
        case "organization_membership.updated": {
            const orgId = eventType === "organization.updated" ? data.id : data.organizationId
            if (orgId) {
                io.to(SocketRooms.organization(orgId)).emit(SocketEvents.WORKOS_ORG_UPDATED, {
                    organizationId: orgId
                })

                // workos metadata changes affect billing view
                if (eventType === "organization.updated") {
                    emitBillingCachesInvalidated(orgId)
                }
            }
            const workosUserId = (data as { user?: { id: string }; user_id?: string }).user?.id ?? (data as { user_id?: string }).user_id
            if (workosUserId) {
                io.to(SocketRooms.user(workosUserId)).emit(SocketEvents.WORKOS_USER_UPDATED, {
                    userId: workosUserId
                })
            }
            break
        }
        default:
            logger.debug("Unhandled WorkOS webhook event", { eventType })
    }
}

/**
 * Handle incoming WorkOS webhooks.
 * Validates signature, responds 200 immediately, processes events asynchronously.
 */
export async function handleWorkOSWebhook(req: Request, res: Response): Promise<void> {
    const webhookSecret = settings.workos.webhookSecret
    if (!webhookSecret) {
        logger.error("WORKOS_WEBHOOK_SECRET not configured")
        res.status(500).send("Webhook not configured")
        return
    }

    const rawBody = req.body as Buffer
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
        logger.error("WorkOS webhook: missing or invalid raw body")
        res.status(400).send("Bad Request")
        return
    }

    const sigHeader = req.get("workos-signature") ?? req.get("WorkOS-Signature") ?? ""
    if (!sigHeader) {
        logger.error("WorkOS webhook: missing WorkOS-Signature header")
        res.status(401).send("Unauthorized")
        return
    }

    try {
        const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>
        const event = await workos.webhooks.constructEvent({
            payload,
            sigHeader,
            secret: webhookSecret
        })

        const webhookEvent = event

        // Respond immediately per WorkOS best practices
        res.status(200).send("OK")

        // Process asynchronously
        processWorkOSEvent(webhookEvent).catch(err => {
            logger.error("Error processing WorkOS webhook event", {
                error: err,
                eventId: webhookEvent.id
            })
        })
    } catch (error) {
        logger.error("WorkOS webhook signature verification failed", { error })
        res.status(401).send("Unauthorized")
    }
}

async function ensureDefaultNotificationSettings(workosUserId: string): Promise<void> {
    await db().user_notification_settings.upsert({
        where: { user_id: workosUserId },
        create: {
            user_id: workosUserId,
            agent_default_notifications: ["error"],
            weekly_agent_improvements: true
        },
        update: {}
    })
}

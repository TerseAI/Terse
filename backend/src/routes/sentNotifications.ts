import { NotificationDestinationType, SentNotificationEventType as PrismaSentNotificationEventType, SentNotificationStatus as PrismaSentNotificationStatus } from "@prisma/client"
import { Request, Response } from "express"

import logger from "../logger"
import { db } from "../prismaClient"
import { GetSentNotificationsResponse, SentNotificationEventType, SentNotificationStatus } from "../shared/SentNotifications"
import { parsePageParams } from "../utility/pagination"

function convertPrismaEventTypeToShared(value: PrismaSentNotificationEventType): SentNotificationEventType {
    switch (value) {
        case PrismaSentNotificationEventType.run_notification:
            return SentNotificationEventType.RUN_NOTIFICATION
        case PrismaSentNotificationEventType.approval_request:
            return SentNotificationEventType.APPROVAL_REQUEST
        case PrismaSentNotificationEventType.run_failure:
            return SentNotificationEventType.RUN_FAILURE
        case PrismaSentNotificationEventType.weekly_review:
            return SentNotificationEventType.WEEKLY_REVIEW
        default:
            throw value satisfies never
    }
}

function convertPrismaStatusToShared(value: PrismaSentNotificationStatus): SentNotificationStatus {
    switch (value) {
        case PrismaSentNotificationStatus.sent:
            return SentNotificationStatus.SENT
        case PrismaSentNotificationStatus.failed:
            return SentNotificationStatus.FAILED
        default:
            throw value satisfies never
    }
}

function convertDestinationType(destinationType: NotificationDestinationType): "email" | "slack" {
    switch (destinationType) {
        case NotificationDestinationType.EMAIL:
            return "email"
        case NotificationDestinationType.SLACK:
            return "slack"
        default:
            throw destinationType satisfies never
    }
}

export async function getSentNotifications(req: Request, res: Response) {
    try {
        const user = req.session?.user
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" })
        }

        const organizationId = user.organizationId
        if (!organizationId) {
            return res.status(400).json({ error: "Organization context is required" })
        }

        const { page, pageSize, skip, take } = parsePageParams(req, 12, 100)

        const [total, rows] = await db().$transaction([
            db().sent_notifications.count({
                where: {
                    organization_id: organizationId
                }
            }),
            db().sent_notifications.findMany({
                where: {
                    organization_id: organizationId
                },
                orderBy: {
                    sent_at: "desc"
                },
                skip,
                take
            })
        ])

        const response: GetSentNotificationsResponse = {
            items: rows.map(row => ({
                id: row.id,
                eventType: convertPrismaEventTypeToShared(row.event_type),
                destinationType: convertDestinationType(row.destination_type),
                destinationLabel: row.destination_label,
                status: convertPrismaStatusToShared(row.status),
                agentName: row.agent_name ?? undefined,
                agentId: row.automation_id ?? undefined,
                runId: row.run_id ?? undefined,
                sentAt: row.sent_at.toISOString(),
                errorMessage: row.error_message ?? undefined
            })),
            page,
            pageSize,
            total
        }

        return res.status(200).json(response)
    } catch (error) {
        logger.error("[SentNotifications] Failed to fetch sent notifications", {
            error,
            userId: req.session?.user?.id
        })
        return res.status(500).json({ error: "Failed to fetch sent notifications" })
    }
}

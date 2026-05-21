import { NotificationDestinationType, SentNotificationEventType as PrismaSentNotificationEventType, SentNotificationStatus as PrismaSentNotificationStatus } from "@prisma/client"
import { GetSentNotificationsResponse, SentNotificationEventType, SentNotificationStatus } from "terse-types/SentNotifications"

import { countAndListSentNotifications } from "./repository"

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

export async function listSentNotificationsForOrganization(organizationId: string, page: number, pageSize: number, skip: number, take: number): Promise<GetSentNotificationsResponse> {
    const [total, rows] = await countAndListSentNotifications(organizationId, skip, take)
    return {
        items: rows.map(row => ({
            id: row.id,
            eventType: convertPrismaEventTypeToShared(row.event_type),
            destinationType: convertDestinationType(row.destination_type),
            destinationLabel: row.destination_label,
            status: convertPrismaStatusToShared(row.status),
            agentName: row.agent_name ?? undefined,
            agentId: row.automation_id ?? undefined,
            runId: row.run_id ?? undefined,
            notificationUrl: row.notification_url ?? undefined,
            sentAt: row.sent_at.toISOString(),
            errorMessage: row.error_message ?? undefined
        })),
        page,
        pageSize,
        total
    }
}

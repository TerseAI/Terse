import { NotificationDestinationType, SentNotificationEventType, SentNotificationStatus } from "@prisma/client"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../services/CacheInvalidationService"
import { sentNotificationsKey } from "../shared/InvalidationKeys"
import { RunHistoryAction } from "../shared/RunHistoryTypes"
import { User } from "../shared/types"
import { Agent, AutomationNotificationSettings, UserNotificationDestination } from "../types/prisma"

import { sendEmailApprovalRequest, sendEmailNotification, sendEmailRunFailure } from "./channels/emailNotifications"
import { sendSlackApprovalRequest, sendSlackNotification, sendSlackRunFailure } from "./channels/slackNotifications"

const SENT_NOTIFICATIONS_INVALIDATION_KEY = sentNotificationsKey()[0]

export class NotificationManager {
    private user: User
    private agent: Agent

    constructor(user: User, agent: Agent) {
        this.user = user
        this.agent = agent
    }

    async notify(runAction: RunHistoryAction) {
        // Get the notification settings for the automation
        const notificationSettings: AutomationNotificationSettings | null = await db().automation_notification_settings.findFirst({
            where: {
                automation_id: this.agent.id
            }
        })

        if (!notificationSettings) {
            logger.debug(`No notification settings found for automation ${this.agent.name}. Skipping`)
            return
        }

        if (!notificationSettings.enabled) {
            logger.debug(`Notifications disabled for automation ${this.agent.name}. Skipping`)
            return
        }

        if (!notificationSettings.action_types.includes(runAction.type)) {
            logger.debug(`Notification settings for automation ${this.agent.name} do not include action ${runAction.type}. Skipping`)
            return
        }

        const notificationDestination = await resolveNotificationDestination(this.user)
        let notificationError: unknown

        try {
            switch (notificationDestination.destination_type) {
                case NotificationDestinationType.SLACK:
                    await sendSlackNotification(notificationDestination, runAction, this.agent)
                    break
                case NotificationDestinationType.EMAIL:
                    await sendEmailNotification(notificationDestination, runAction, this.agent)
                    break
            }
        } catch (error) {
            notificationError = error
            throw error
        } finally {
            await this.trackNotification({
                eventType: SentNotificationEventType.run_notification,
                destination: notificationDestination,
                error: notificationError
            })
        }
    }

    async notifyApprovalRequest(runId: string, runAction: RunHistoryAction) {
        if (!runAction.step_id) {
            logger.debug(`No step_id found in runAction. Cannot send approval notification.`)
            return
        }

        const notificationDestination = await resolveNotificationDestination(this.user)
        let notificationError: unknown

        try {
            switch (notificationDestination.destination_type) {
                case NotificationDestinationType.SLACK:
                    await sendSlackApprovalRequest(notificationDestination, runId, runAction, this.agent)
                    break
                case NotificationDestinationType.EMAIL:
                    await sendEmailApprovalRequest(notificationDestination, runId, runAction, this.agent, this.user)
                    break
            }
        } catch (error) {
            notificationError = error
            throw error
        } finally {
            await this.trackNotification({
                eventType: SentNotificationEventType.approval_request,
                destination: notificationDestination,
                runId,
                error: notificationError
            })
        }
    }

    async notifyRunFailure(runId: string, errorMessage: string) {
        const notificationDestination = await resolveNotificationDestination(this.user)
        let notificationError: unknown

        try {
            switch (notificationDestination.destination_type) {
                case NotificationDestinationType.SLACK:
                    await sendSlackRunFailure(notificationDestination, this.agent, runId, errorMessage)
                    break
                case NotificationDestinationType.EMAIL:
                    await sendEmailRunFailure(notificationDestination, this.agent, runId, errorMessage)
                    break
            }
        } catch (error) {
            notificationError = error
            throw error
        } finally {
            await this.trackNotification({
                eventType: SentNotificationEventType.run_failure,
                destination: notificationDestination,
                runId,
                error: notificationError
            })
        }
    }

    private async trackNotification({ eventType, destination, runId, error }: { eventType: SentNotificationEventType; destination: UserNotificationDestination; runId?: string; error?: unknown }) {
        try {
            if (!this.user.organizationId) {
                logger.warn("[NotificationManager] Missing organizationId, skipping sent notification tracking", {
                    userId: this.user.id,
                    automationId: this.agent.id
                })
                return
            }

            const errorMessage = error instanceof Error ? error.message : error ? String(error) : null
            const status = error ? SentNotificationStatus.failed : SentNotificationStatus.sent

            await db().sent_notifications.create({
                data: {
                    organization_id: this.user.organizationId,
                    user_id: this.user.id,
                    automation_id: this.agent.id,
                    run_id: runId ?? null,
                    event_type: eventType,
                    destination_type: destination.destination_type,
                    destination_label: this.getDestinationLabel(destination),
                    status,
                    error_message: errorMessage,
                    agent_name: this.agent.name
                }
            })

            emitCacheInvalidationWithKey(this.user.organizationId, SENT_NOTIFICATIONS_INVALIDATION_KEY)
        } catch (trackingError) {
            logger.error("[NotificationManager] Failed to track sent notification", {
                error: trackingError,
                eventType,
                runId,
                userId: this.user.id,
                automationId: this.agent.id
            })
        }
    }

    private getDestinationLabel(destination: UserNotificationDestination): string {
        if (destination.destination_type === NotificationDestinationType.SLACK) {
            if (destination.slack_channel_name) {
                return `#${destination.slack_channel_name}`
            }

            if (destination.slack_user_name) {
                return `DM @${destination.slack_user_name}`
            }

            if (destination.slack_channel_id) {
                return `#${destination.slack_channel_id}`
            }

            if (destination.slack_user_id) {
                return `DM @${destination.slack_user_id}`
            }

            return "Slack"
        }

        return destination.email_address || this.user.email
    }
}

async function getActiveNotificationDestinationByType(userId: string, destinationType: NotificationDestinationType): Promise<UserNotificationDestination | null> {
    return db().user_notification_destinations.findFirst({
        where: {
            user_id: userId,
            is_active: true,
            destination_type: destinationType
        },
        orderBy: {
            updated_at: "desc"
        }
    })
}

async function resolveNotificationDestination(user: User): Promise<UserNotificationDestination> {
    const slackDestination = await getActiveNotificationDestinationByType(user.id, NotificationDestinationType.SLACK)
    if (slackDestination) {
        return slackDestination
    }

    const emailDestination = await getActiveNotificationDestinationByType(user.id, NotificationDestinationType.EMAIL)
    if (emailDestination) {
        return emailDestination
    }

    return getDefaultEmailNotificationDestination(user)
}

function getDefaultEmailNotificationDestination(user: User): UserNotificationDestination {
    return {
        id: "",
        user_id: user.id,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        destination_type: NotificationDestinationType.EMAIL,
        email_address: user.email,
        slack_integration_id: null,
        slack_channel_id: null,
        slack_channel_name: null,
        slack_user_name: null,
        slack_user_id: null
    }
}

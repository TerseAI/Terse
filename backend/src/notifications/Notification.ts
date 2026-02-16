import { NotificationDestinationType } from "@prisma/client"

import { generateApprovalSummary } from "../agent/ApprovalSummaryAgent/ApprovalSummaryAgent"
import logger from "../logger"
import { db } from "../prismaClient"
import { RunHistoryAction } from "../shared/RunHistoryTypes"
import { User } from "../shared/types"
import { Agent, AutomationNotificationSettings, UserNotificationDestination } from "../types/prisma"
import { formatNotificationMessage, formatRunFailureNotificationMessage, resolveSlackChannelIdForDestination, sendSlackApprovalMessage, sendSlackMessage } from "../utility/slack"

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

        const notificationDestinations: UserNotificationDestination | null = await db().user_notification_destinations.findFirst({
            where: {
                user_id: this.user.id
            }
        })

        if (!notificationDestinations) {
            logger.debug(`No notification destinations found for user ${this.user.email}. Skipping`)
            return
        }

        if (!notificationSettings.action_types.includes(runAction.type)) {
            logger.debug(`Notification settings for automation ${this.agent.name} do not include action ${runAction.type}. Skipping`)
            return
        }

        switch (notificationDestinations.destination_type) {
            case NotificationDestinationType.SLACK:
                await notifySlack(notificationDestinations, runAction, this.agent)
                break
            case NotificationDestinationType.EMAIL:
                await notifyEmail(notificationDestinations, runAction)
                break
        }
    }

    async notifyApprovalRequest(runId: string, runAction: RunHistoryAction) {
        if (!runAction.step_id) {
            logger.debug(`No step_id found in runAction. Cannot send approval notification.`)
            return
        }

        const notificationDestinations: UserNotificationDestination | null = await db().user_notification_destinations.findFirst({
            where: {
                user_id: this.user.id
            }
        })

        if (!notificationDestinations) {
            logger.debug(`No notification destinations found for user ${this.user.email}. Skipping`)
            return
        }

        switch (notificationDestinations.destination_type) {
            case NotificationDestinationType.SLACK:
                await notifyApprovalRequest(notificationDestinations, runId, runAction, this.agent, this.user)
                break
            case NotificationDestinationType.EMAIL:
                // TODO: Implement email approval notifications
                logger.debug(`Email approval notifications not yet implemented`)
                break
        }
    }

    async notifyRunFailure(runId: string, errorMessage: string) {
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

        if (!notificationSettings.notify_on_run_failure) {
            logger.debug(`Run failure notifications disabled for automation ${this.agent.name}. Skipping`)
            return
        }

        const notificationDestinations: UserNotificationDestination | null = await db().user_notification_destinations.findFirst({
            where: {
                user_id: this.user.id
            }
        })

        if (!notificationDestinations) {
            logger.debug(`No notification destinations found for user ${this.user.email}. Skipping`)
            return
        }

        switch (notificationDestinations.destination_type) {
            case NotificationDestinationType.SLACK:
                await notifySlackRunFailure(notificationDestinations, this.agent, runId, errorMessage)
                break
            case NotificationDestinationType.EMAIL:
                logger.debug(`Email run failure notifications not yet implemented`)
                break
        }
    }
}

async function notifySlack(notificationDestination: UserNotificationDestination, runAction: RunHistoryAction, agent: Agent) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifySlack] No Slack integration ID found. Skipping.`)
        return
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifySlack] No Slack channel ID configured. Skipping.`)
        return
    }

    const message = formatNotificationMessage(runAction, { channelName: agent.name })

    await sendSlackMessage(notificationDestination.slack_integration_id, targetChannelId, message)
}

async function notifyApprovalRequest(notificationDestination: UserNotificationDestination, runId: string, runAction: RunHistoryAction, agent: Agent, user: User) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifyApprovalRequest] No Slack integration ID found. Skipping.`)
        return
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifyApprovalRequest] No Slack channel ID configured. Skipping.`)
        return
    }

    if (!runAction.step_id) {
        logger.debug(`[notifyApprovalRequest] No step_id found in runAction. Skipping.`)
        return
    }

    const { approvalSummary } = await generateApprovalSummary(runId, user, agent.id, runAction.step_id)

    await sendSlackApprovalMessage(notificationDestination.slack_integration_id, targetChannelId, runId, runAction.step_id, approvalSummary, agent.name, agent.id)
}

async function notifySlackRunFailure(notificationDestination: UserNotificationDestination, agent: Agent, runId: string, errorMessage: string) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifySlackRunFailure] No Slack integration ID found. Skipping.`)
        return
    }

    const targetChannelId = await resolveSlackChannelIdForDestination(notificationDestination.slack_integration_id, notificationDestination.slack_channel_id, notificationDestination.slack_user_id)

    if (!targetChannelId) {
        logger.debug(`[notifySlackRunFailure] No Slack channel ID configured. Skipping.`)
        return
    }

    const message = formatRunFailureNotificationMessage({
        agentId: agent.id,
        agentName: agent.name,
        runId,
        errorMessage
    })

    await sendSlackMessage(notificationDestination.slack_integration_id, targetChannelId, message)
}

// Not supported yet, just wanted to make sure this was built with mulitple notification destinations in mind
async function notifyEmail(notificationDestinations: UserNotificationDestination, runAction: RunHistoryAction) {
    logger.info(`Notifying Email for user ${notificationDestinations.user_id} with action ${runAction}`)
}

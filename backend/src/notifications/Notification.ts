import { NotificationDestinationType, RunHistoryActionType } from "@prisma/client";
import { db } from "../prismaClient";
import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { User, Channel, UserNotificationDestination, AutomationNotificationSettings } from "../types/prisma";
import { formatNotificationMessage, sendSlackMessage, sendSlackApprovalMessage } from "../utility/slack";
import { generateApprovalSummary } from "../agent/ApprovalSummaryAgent/ApprovalSummaryAgent";
import logger from "../logger";

export class NotificationManager {
    private user: User;
    private channel: Channel;

    constructor(user: User, channel: Channel) {
        this.user = user;
        this.channel = channel;
    }

    async notify(runAction: RunHistoryAction, runId?: string) {
        // Get the notification settings for the automation
        const notificationSettings: AutomationNotificationSettings | null = await db().automation_notification_settings.findFirst({
            where: {
                automation_id: this.channel.id,
            },
        });

        if (!notificationSettings) {
            logger.debug(`No notification settings found for automation ${this.channel.name}. Skipping`);
            return;
        }

        if (!notificationSettings.enabled) {
            logger.debug(`Notifications disabled for automation ${this.channel.name}. Skipping`);
            return;
        }

        const notificationDestinations: UserNotificationDestination | null = await db().user_notification_destinations.findFirst({
            where: {
                user_id: this.user.id,
            },
        });

        if (!notificationDestinations) {
            logger.debug(`No notification destinations found for user ${this.user.email}. Skipping`);
            return;
        }

        if (!notificationSettings.action_types.includes(runAction.type)) {
            logger.debug(`Notification settings for automation ${this.channel.name} do not include action ${runAction.type}. Skipping`);
            return;
        }

        // Handle approval notifications specially
        if (runAction.type === RunHistoryActionType.approval && runId && runAction.step_id) {
            switch (notificationDestinations.destination_type) {
                case NotificationDestinationType.SLACK:
                    await notifyApprovalRequest(notificationDestinations, runId, runAction, this.channel, this.user.id);
                    break;
                case NotificationDestinationType.EMAIL:
                    await notifyEmail(notificationDestinations, runAction);
                    break;
            }
            return;
        }

        switch (notificationDestinations.destination_type) {
            case NotificationDestinationType.SLACK:
                await notifySlack(notificationDestinations, runAction, this.channel);
                break;
            case NotificationDestinationType.EMAIL:
                await notifyEmail(notificationDestinations, runAction);
                break;
        }
    }
}

async function notifySlack(notificationDestination: UserNotificationDestination, runAction: RunHistoryAction, channel: Channel) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifySlack] No Slack integration ID found. Skipping.`);
        return;
    }

    if (!notificationDestination.slack_channel_id) {
        logger.debug(`[notifySlack] No Slack channel ID configured. Skipping.`);
        return;
    }

    const message = formatNotificationMessage(runAction, { channelName: channel.name });

    await sendSlackMessage(
        notificationDestination.slack_integration_id,
        notificationDestination.slack_channel_id,
        message
    );
}

async function notifyApprovalRequest(
    notificationDestination: UserNotificationDestination,
    runId: string,
    runAction: RunHistoryAction,
    channel: Channel,
    userId: string
) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifyApprovalRequest] No Slack integration ID found. Skipping.`);
        return;
    }

    if (!notificationDestination.slack_channel_id) {
        logger.debug(`[notifyApprovalRequest] No Slack channel ID configured. Skipping.`);
        return;
    }

    if (!runAction.step_id) {
        logger.debug(`[notifyApprovalRequest] No step_id found in runAction. Skipping.`);
        return;
    }

    const { approvalSummary } = await generateApprovalSummary(
        runId,
        userId,
        channel.id,
        runAction.step_id
    );

    await sendSlackApprovalMessage(
        notificationDestination.slack_integration_id,
        notificationDestination.slack_channel_id,
        runId,
        runAction.step_id,
        approvalSummary,
        channel.name,
        channel.id
    );
}

// Not supported yet, just wanted to make sure this was built with mulitple notification destinations in mind
async function notifyEmail(notificationDestinations: UserNotificationDestination, runAction: RunHistoryAction) {
    logger.info(`Notifying Email for user ${notificationDestinations.user_id} with action ${runAction}`);
}
import { NotificationDestinationType } from "@prisma/client";
import { db } from "../prismaClient";
import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { User, Channel, UserNotificationDestination, AutomationNotificationSettings } from "../types/prisma";
import { formatNotificationMessage, sendSlackMessage } from "../utility/slack";

export class NotificationManager {
    private user: User;
    private channel: Channel;

    constructor(user: User, channel: Channel) {
        this.user = user;
        this.channel = channel;
    }

    async notify(runAction: RunHistoryAction) {
         // Get the notification settings for the automation
         const notificationSettings: AutomationNotificationSettings | null = await db().automation_notification_settings.findFirst({
            where: {
                automation_id: this.channel.id,
            },
        });

        if (!notificationSettings) {
            console.log(`No notification settings found for automation ${this.channel.name}. Skipping`);
            return;
        }

        if (!notificationSettings.enabled) {
            console.log(`Notifications disabled for automation ${this.channel.name}. Skipping`);
            return;
        }

        const notificationDestinations: UserNotificationDestination | null = await db().user_notification_destinations.findFirst({
            where: {
                user_id: this.user.id,
            },
        });

        if (!notificationDestinations) {
            console.log(`No notification destinations found for user ${this.user.email}. Skipping`);
            return;
        }

        if (!notificationSettings.action_types.includes(runAction.type)) {
            console.log(`Notification settings for automation ${this.channel.name} do not include action ${runAction.type}. Skipping`);
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
        console.log(`[notifySlack] No Slack integration ID found. Skipping.`);
        return;
    }

    if (!notificationDestination.slack_channel_id) {
        console.log(`[notifySlack] No Slack channel ID configured. Skipping.`);
        return;
    }

    const message = formatNotificationMessage(runAction, { channelName: channel.name });
    
    await sendSlackMessage(
        notificationDestination.slack_integration_id,
        notificationDestination.slack_channel_id,
        message
    );
}

async function notifyEmail(notificationDestinations: UserNotificationDestination, runAction: RunHistoryAction) {
    console.log(`Notifying Email for user ${notificationDestinations.user_id} with action ${runAction}`);
}
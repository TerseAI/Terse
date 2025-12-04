import { NotificationDestinationType } from "@prisma/client";
import { db } from "../prismaClient";
import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { User, Channel, UserNotificationDestination, AutomationNotificationSettings, SlackIntegration } from "../types/prisma";

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
                await notifySlack(notificationDestinations, runAction);
                break;
            case NotificationDestinationType.EMAIL:
                await notifyEmail(notificationDestinations, runAction);
                break;
        }
    }
}

async function notifySlack(notificationDestinations: UserNotificationDestination, runAction: RunHistoryAction) {
    console.log(`Notifying Slack for user ${notificationDestinations.user_id} with action ${runAction}`);
    if (!notificationDestinations.slack_integration_id) {
        console.log(`No Slack integration ID found for user ${notificationDestinations.user_id}. Skippin. (This should never happen)`);
        return;
    }

    const slackIntegration: SlackIntegration | null = await db().slack_integrations.findFirst({
        where: {
            id: notificationDestinations.slack_integration_id,
        },
    });

    if (!slackIntegration) {
        console.log(`No Slack integration found for user ${notificationDestinations.user_id}. Skipping. (This should never happen)`);
        return;
    }

    console.log(`Notifying Slack for user ${notificationDestinations.user_id} with action ${runAction.action} to integration ${slackIntegration.app_id}`);
}

async function notifyEmail(notificationDestinations: UserNotificationDestination, runAction: RunHistoryAction) {
    console.log(`Notifying Email for user ${notificationDestinations.user_id} with action ${runAction}`);
}
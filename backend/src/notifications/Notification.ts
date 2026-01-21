import { NotificationDestinationType, RunHistoryActionType } from "@prisma/client";
import { db } from "../prismaClient";
import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { User, Agent, UserNotificationDestination, AgentNotificationSettings } from "../types/prisma";
import { formatNotificationMessage, sendSlackMessage, sendSlackApprovalMessage } from "../utility/slack";
import { generateApprovalSummary } from "../agent/ApprovalSummaryAgent/ApprovalSummaryAgent";
import logger from "../logger";

export class NotificationManager {
    private user: User;
    private agent: Agent;

    constructor(user: User, agent: Agent) {
        this.user = user;
        this.agent = agent;
    }

    async notify(runAction: RunHistoryAction) {
        // Get the notification settings for the agent
        const notificationSettings: AgentNotificationSettings | null = await db().automation_notification_settings.findFirst({
            where: {
                automation_id: this.agent.id,
            },
        });

        if (!notificationSettings) {
            logger.debug(`No notification settings found for agent ${this.agent.name}. Skipping`);
            return;
        }

        if (!notificationSettings.enabled) {
            logger.debug(`Notifications disabled for agent ${this.agent.name}. Skipping`);
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
            logger.debug(`Notification settings for agent ${this.agent.name} do not include action ${runAction.type}. Skipping`);
            return;
        }

        switch (notificationDestinations.destination_type) {
            case NotificationDestinationType.SLACK:
                await notifySlack(notificationDestinations, runAction, this.agent);
                break;
            case NotificationDestinationType.EMAIL:
                await notifyEmail(notificationDestinations, runAction);
                break;
        }
    }

    async notifyApprovalRequest(runId: string, runAction: RunHistoryAction) {
        if (!this.agent.require_approval) {
            logger.debug(`Agent ${this.agent.name} does not require approval. Skipping approval notification.`);
            return;
        }

        if (!runAction.step_id) {
            logger.debug(`No step_id found in runAction. Cannot send approval notification.`);
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

        switch (notificationDestinations.destination_type) {
            case NotificationDestinationType.SLACK:
                await notifyApprovalRequest(notificationDestinations, runId, runAction, this.agent, this.user.id);
                break;
            case NotificationDestinationType.EMAIL:
                // TODO: Implement email approval notifications
                logger.debug(`Email approval notifications not yet implemented`);
                break;
        }
    }
}

async function notifySlack(notificationDestination: UserNotificationDestination, runAction: RunHistoryAction, agent: Agent) {
    if (!notificationDestination.slack_integration_id) {
        logger.debug(`[notifySlack] No Slack integration ID found. Skipping.`);
        return;
    }

    if (!notificationDestination.slack_channel_id) {
        logger.debug(`[notifySlack] No Slack channel ID configured. Skipping.`);
        return;
    }

    const message = formatNotificationMessage(runAction, { channelName: agent.name });

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
    agent: Agent,
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
        agent.id,
        runAction.step_id
    );

    await sendSlackApprovalMessage(
        notificationDestination.slack_integration_id,
        notificationDestination.slack_channel_id,
        runId,
        runAction.step_id,
        approvalSummary,
        agent.name,
        agent.id
    );
}

// Not supported yet, just wanted to make sure this was built with mulitple notification destinations in mind
async function notifyEmail(notificationDestinations: UserNotificationDestination, runAction: RunHistoryAction) {
    logger.info(`Notifying Email for user ${notificationDestinations.user_id} with action ${runAction}`);
}
import { WebClient, LogLevel, KnownBlock } from "@slack/web-api";
import { db } from "../prismaClient";
import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { initializeSlackWebClient } from "../integrations/SlackIntegration";
import logger from "../logger";

export interface SlackMessage {
    text: string;
    blocks?: KnownBlock[];
}

export interface NotificationContext {
    channelName: string;
}
export async function sendSlackMessage(
    userSlackIntegrationId: string,
    channelId: string,
    message: SlackMessage
): Promise<boolean> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId,
        },
        include: {
            slack_integration: true,
            user: true,
        },
    });

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[sendSlackMessage] No Slack integration found for ID: ${userSlackIntegrationId}`, { userSlackIntegrationId });
        return false;
    }

    const client: WebClient = initializeSlackWebClient(userSlackIntegration);
    logger.debug(`[sendSlackMessage] Message`, { message, channelId, userSlackIntegrationId });

    try {
        await client.chat.postMessage({
            channel: channelId,
            text: message.text,
            blocks: message.blocks,
        });

        logger.info(`[sendSlackMessage] Successfully sent message to channel ${channelId}`, { channelId, userSlackIntegrationId });
        return true;
    } catch (error) {
        logger.error(`[sendSlackMessage] Failed to send message`, { error, channelId, userSlackIntegrationId });
        return false;
    }
}

export async function getSlackClient(userSlackIntegrationId: string): Promise<WebClient | null> {
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            id: userSlackIntegrationId,
        },
        include: {
            slack_integration: true,
        },
    });

    if (!userSlackIntegration?.slack_integration) {
        logger.error(`[getSlackClient] No Slack integration found for ID: ${userSlackIntegrationId}`, { userSlackIntegrationId });
        return null;
    }

    return new WebClient(userSlackIntegration.slack_integration.access_token, { 
        logLevel: LogLevel.ERROR 
    });
}

export function formatNotificationMessage(runAction: RunHistoryAction, context: NotificationContext): SlackMessage {
    const actionEmoji = {
        create: '➕',
        update: '🔄',
        delete: '➖',
        read: '🔍',
    }[runAction.type] || '🔔';

    const text = `${context.channelName} - ${actionEmoji} ${runAction.action} - ${runAction.target}`;
    
    const blocks: KnownBlock[] = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${runAction.action}* - ${actionEmoji} ${runAction.target}`,
            },
        },
    ];

    if (runAction.details) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: runAction.details,
            },
        });
    }

    if (runAction.url) {
        blocks.push({
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: {
                        type: 'plain_text',
                        text: 'View',
                        emoji: true,
                    },
                    url: runAction.url,
                    action_id: 'view_action',
                },
            ],
        });
    }

    return { text, blocks };
}


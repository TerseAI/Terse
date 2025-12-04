import { WebClient, LogLevel } from "@slack/web-api";
import { db } from "../prismaClient";
import { RunHistoryAction } from "../shared/RunHistoryTypes";

export interface SlackMessage {
    text: string;
    blocks?: any[];
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
        },
    });

    if (!userSlackIntegration?.slack_integration) {
        console.error(`[sendSlackMessage] No Slack integration found for ID: ${userSlackIntegrationId}`);
        return false;
    }

    const botToken = userSlackIntegration.slack_integration.access_token;
    const client = new WebClient(botToken, { logLevel: LogLevel.ERROR });

    try {
        await client.chat.postMessage({
            channel: channelId,
            text: message.text,
            blocks: message.blocks,
        });

        console.log(`[sendSlackMessage] Successfully sent message to channel ${channelId}`);
        return true;
    } catch (error) {
        console.error(`[sendSlackMessage] Failed to send message:`, error);
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
        console.error(`[getSlackClient] No Slack integration found for ID: ${userSlackIntegrationId}`);
        return null;
    }

    return new WebClient(userSlackIntegration.slack_integration.access_token, { 
        logLevel: LogLevel.ERROR 
    });
}

export function formatNotificationMessage(runAction: RunHistoryAction, context: NotificationContext): SlackMessage {
    const actionEmoji = {
        create: '✨',
        update: '📝',
        delete: '🗑️',
        read: '👁️',
    }[runAction.type] || '🔔';

    const text = `${actionEmoji} ${runAction.action} - ${context.channelName}`;
    
    const blocks: any[] = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `${actionEmoji} *${runAction.action}*`,
            },
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `Channel: *${context.channelName}* | Target: ${runAction.target}`,
                },
            ],
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


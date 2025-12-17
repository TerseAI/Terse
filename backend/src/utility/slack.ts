import { WebClient, LogLevel, KnownBlock } from "@slack/web-api";
import { db } from "../prismaClient";
import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { initializeSlackWebClient } from "../integrations/SlackIntegration";
import { settings } from "../config/settings";
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
        approval: '⏳',
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

export async function sendSlackApprovalMessage(
    userSlackIntegrationId: string,
    channelId: string,
    runId: string,
    stepId: string,
    summary: string,
    channelName: string,
    automationId?: string
): Promise<{ success: boolean; messageTs?: string }> {
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
        logger.error(`[sendSlackApprovalMessage] No Slack integration found for ID: ${userSlackIntegrationId}`);
        return { success: false };
    }

    const client: WebClient = initializeSlackWebClient(userSlackIntegration);

    // Build deep link to run history if automationId is provided
    let runHistoryLink: string | undefined;
    if (automationId) {
        const frontendUrl = settings.urls.frontend;
        runHistoryLink = `${frontendUrl}/app/channels/${automationId}?tab=history&runId=${runId}`;
    }

    const blocks: KnownBlock[] = [
        {
            type: 'section' as const,
            text: {
                type: 'mrkdwn' as const,
                text: `You have a new approval request:\n*<${runHistoryLink || '#'}|${channelName} - Action pending approval>*`,
            },
        },
        {
            type: 'section' as const,
            fields: [
                {
                    type: 'mrkdwn' as const,
                    text: `*Channel:*\n${channelName}`,
                },
                {
                    type: 'mrkdwn' as const,
                    text: `*Status:*\n:clock1: Pending approval`,
                },
                {
                    type: 'mrkdwn' as const,
                    text: `*Action:*\n${summary}`,
                }
            ],
        },
        {
            type: 'actions' as const,
            elements: [
                {
                    type: 'button' as const,
                    text: {
                        type: 'plain_text' as const,
                        emoji: true,
                        text: 'Approve',
                    },
                    style: 'primary' as const,
                    action_id: `approval_approve_${runId}__${stepId}`,
                    value: 'approve',
                },
                {
                    type: 'button' as const,
                    text: {
                        type: 'plain_text' as const,
                        emoji: true,
                        text: 'Reject',
                    },
                    style: 'danger' as const,
                    action_id: `approval_reject_${runId}__${stepId}`,
                    value: 'reject',
                },
                ...(runHistoryLink ? [{
                    type: 'button' as const,
                    text: {
                        type: 'plain_text' as const,
                        emoji: true,
                        text: 'View Details',
                    },
                    url: runHistoryLink,
                    action_id: 'view_run_history',
                }] : []),
            ],
        },
    ];

    const text = `Approval Request: ${summary} - ${channelName}`;

    try {
        const result = await client.chat.postMessage({
            channel: channelId,
            text: text,
            blocks: blocks,
        });

        if (result.ok && result.ts) {
            // Store message metadata in database
            await db().approval_slack_messages.create({
                data: {
                    run_id: runId,
                    step_id: stepId,
                    slack_channel_id: channelId,
                    slack_message_ts: result.ts,
                    user_slack_integration_id: userSlackIntegrationId,
                    status: 'pending',
                    summary: summary,
                },
            });
            logger.info(`[sendSlackApprovalMessage] Successfully sent approval message to channel ${channelId} with ts ${result.ts}`);
            return { success: true, messageTs: result.ts };
        } else {
            logger.error(`[sendSlackApprovalMessage] Failed to send message: ${result.error}`);
            return { success: false };
        }
    } catch (error) {
        logger.error(`[sendSlackApprovalMessage] Failed to send message:`, { error });
        return { success: false };
    }
}

export async function updateSlackApprovalMessage(
    userSlackIntegrationId: string,
    channelId: string,
    messageTs: string,
    status: 'approved' | 'rejected' | 'processing' | 'failed',
    summary: string, // Human-readable summary instead of toolName
    channelName: string,
    automationId?: string,
    runId?: string,
    stepId?: string
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
        logger.error(`[updateSlackApprovalMessage] No Slack integration found for ID: ${userSlackIntegrationId}`);
        return false;
    }

    const client: WebClient = initializeSlackWebClient(userSlackIntegration);

    let statusEmoji: string;
    let statusText: string;
    
    if (status === 'processing') {
        statusEmoji = '⏳';
        statusText = 'Processing';
    } else if (status === 'failed') {
        statusEmoji = '⚠️';
        statusText = 'Failed';
    } else if (status === 'approved') {
        statusEmoji = '✅';
        statusText = 'Approved';
    } else {
        statusEmoji = '❌';
        statusText = 'Rejected';
    }

    // Fetch rejection reason from database if status is rejected and runId/stepId are available
    let rejectionReason: string | null = null;
    if (status === 'rejected' && runId && stepId) {
        const approvalMessage = await db().approval_slack_messages.findFirst({
            where: {
                run_id: runId,
                step_id: stepId,
            },
        });
        if (approvalMessage?.rejection_reason) {
            rejectionReason = approvalMessage.rejection_reason;
        }
    }

    // Build deep link to run history if automationId and runId are provided
    let runHistoryLink: string | undefined;
    if (automationId && runId) {
        const frontendUrl = settings.urls.frontend;
        runHistoryLink = `${frontendUrl}/app/channels/${automationId}?tab=history&runId=${runId}`;
    }

    const blocks: KnownBlock[] = [
        {
            type: 'section' as const,
            text: {
                type: 'mrkdwn' as const,
                text: `Approval request ${
                    status === 'approved'
                        ? 'approved'
                        : status === 'rejected'
                            ? 'rejected'
                            : status === 'failed'
                                ? 'failed'
                                : 'is being processed'
                }:\n*<${runHistoryLink || '#'}|${channelName} - ${statusText}>*`,
            },
        },
        {
            type: 'section' as const,
            fields: [
                {
                    type: 'mrkdwn' as const,
                    text: `*Channel:*\n${channelName}`,
                },
                {
                    type: 'mrkdwn' as const,
                    text: `*Status:*\n${statusEmoji} ${statusText}`,
                },
                {
                    type: 'mrkdwn' as const,
                    text: `*Action:*\n${summary}`,
                },
            ],
        },
    ];

    // Add rejection reason section if available
    if (status === 'rejected' && rejectionReason) {
        blocks.push({
            type: 'section' as const,
            text: {
                type: 'mrkdwn' as const,
                text: `*Rejection Reason:*\n${rejectionReason}`,
            },
        });
    }

    // Add view run history button if link is available
    if (runHistoryLink) {
        blocks.push({
            type: 'actions' as const,
            elements: [{
                type: 'button' as const,
                text: {
                    type: 'plain_text' as const,
                    emoji: true,
                    text: 'View Run History',
                },
                url: runHistoryLink,
                action_id: 'view_run_history',
            }],
        });
    }

    const text = `${statusText}: ${summary} - ${channelName}`;

    try {
        const result = await client.chat.update({
            channel: channelId,
            ts: messageTs,
            text: text,
            blocks: blocks,
        });

        if (result.ok) {
            logger.info(`[updateSlackApprovalMessage] Successfully updated approval message in channel ${channelId} to status: ${status}`);
            return true;
        } else {
            logger.error(`[updateSlackApprovalMessage] Failed to update message: ${result.error}`);
            return false;
        }
    } catch (error) {
        logger.error(`[updateSlackApprovalMessage] Failed to update message:`, { error });
        return false;
    }
}


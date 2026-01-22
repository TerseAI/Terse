import { db } from "../../prismaClient";
import SlackChatInterface from "./SlackChatInterface";
import ChatAgent from "./ChatAgent";
import logger from "../../logger";
import { initializeSlackWebClient } from "../../integrations/SlackIntegration";
import { IntegrationType } from "../../shared/Integrations";
import { WebClient } from "@slack/web-api";
import { addEyesReaction, removeEyesReaction } from "../../slack/blockKitHelpers";
import { GenericMessageEvent } from "@slack/types";

export async function resumeChatAgentAfterFormCompletion(
    userId: string,
    chatId: string,
    channel: string,
    integrationType: IntegrationType,
    integrationId: string,
    messageTs?: string
): Promise<void> {
    try {
        // Get user's Slack integration to create WebClient
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: {
                user_id: userId,
            },
            include: {
                slack_integration: true,
                user: true,
            },
            orderBy: {
                created_at: 'desc',
            },
        });

        if (!userSlackIntegration?.slack_integration) {
            logger.error('Cannot resume ChatAgent: No Slack integration found for user', { userId });
            return;
        }

        // Create WebClient
        const client = initializeSlackWebClient(userSlackIntegration);

        const integrationName = formatIntegrationName(integrationType);

        // Create SlackChatInterface
        const slackChatInterface = new SlackChatInterface(
            channel,
            client,
            userId,
            userSlackIntegration.authed_user_id,
            chatId
        );

        if (messageTs) {
            await showIntegrationSuccessMessage(client, channel, messageTs, integrationName);
        }

        // Create ChatAgent
        const chatAgent = new ChatAgent(slackChatInterface, chatId, userId);

        // Run the agent with a message about successful connection
        const message = `The ${integrationName} integration has been successfully connected. Integration ID: ${integrationId}`;
        await chatAgent.run(message);

        if (messageTs) {
            await removeEyesReaction(client, { channel, ts: messageTs } as GenericMessageEvent);
        }

        logger.info('ChatAgent resumed after form completion', { userId, chatId, channel, integrationType, integrationId });
    } catch (error) {
        logger.error('Error resuming ChatAgent after form completion', { error, userId, chatId, channel, integrationType, integrationId });
        // Don't throw - we don't want to break the form completion flow
    }
}

function formatIntegrationName(integrationType: IntegrationType): string {
    return integrationType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());
}

async function showIntegrationSuccessMessage(
    client: WebClient,
    channel: string,
    messageTs: string,
    integrationName: string
): Promise<void> {
    try {
        await client.chat.update({
            channel,
            ts: messageTs,
            text: `${integrationName} Added Successfully!`,
            blocks: [{
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `:white_check_mark: *${integrationName} Added Successfully!*`
                }
            }],
        });

        await addEyesReaction(client, { channel, ts: messageTs } as GenericMessageEvent);
    } catch (error) {
        logger.warn('Failed to update message after form completion', { error, messageTs });
    }
}

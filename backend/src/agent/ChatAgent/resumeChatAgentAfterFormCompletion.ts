import { db } from "../../prismaClient";
import { WebClient } from "@slack/web-api";
import SlackChatInterface from "./SlackChatInterface";
import ChatAgent from "./ChatAgent";
import logger from "../../logger";
import { initializeSlackWebClient } from "../../integrations/SlackIntegration";
import { IntegrationType } from "../../shared/Integrations";

/**
 * Resumes ChatAgent conversation after successful form-based integration installation
 * @param userId - The user ID
 * @param chatId - The chat/thread timestamp (used as sessionId)
 * @param channel - The Slack channel ID
 * @param integrationType - The integration type that was connected
 * @param integrationId - The ID of the integration that was created/updated
 * @param messageTs - Optional message timestamp to replace instead of posting new message
 */
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
        const client = initializeSlackWebClient(userSlackIntegration as any);

        // Create SlackChatInterface
        const slackChatInterface = new SlackChatInterface(channel, client, userId, chatId);
        
        // If messageTs is provided, set it to replace the message instead of posting new one
        if (messageTs) {
            slackChatInterface.setMessageTsToReplace(messageTs);
        }

        // Create ChatAgent
        const chatAgent = new ChatAgent(slackChatInterface, chatId, userId);

        // Get integration name from type
        const integrationName = integrationType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());

        // Run the agent with a message about successful connection
        const message = `The ${integrationName} integration has been successfully connected. Integration ID: ${integrationId}`;
        await chatAgent.run(message);

        logger.info('ChatAgent resumed after form completion', { userId, chatId, channel, integrationType, integrationId });
    } catch (error) {
        logger.error('Error resuming ChatAgent after form completion', { error, userId, chatId, channel, integrationType, integrationId });
        // Don't throw - we don't want to break the form completion flow
    }
}

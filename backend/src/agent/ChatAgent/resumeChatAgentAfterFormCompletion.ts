import { db } from "../../prismaClient";
import SlackChatInterface from "./SlackChatInterface";
import ChatAgent from "./ChatAgent";
import logger from "../../logger";
import { initializeSlackWebClient } from "../../integrations/SlackIntegration";
import { IntegrationType } from "../../shared/Integrations";


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

        // Create SlackChatInterface
        const slackChatInterface = new SlackChatInterface(
            channel,
            client,
            userId,
            userSlackIntegration.authed_user_id,
            chatId
        );
        
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

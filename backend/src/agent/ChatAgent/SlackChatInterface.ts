import { RunStreamEvent } from "@openai/agents";
import { ConfigType } from "../../shared/Configs";
import { Channel } from "../../shared/types";
import ChatInterface from "./ChatInterface";
import { IntegrationType } from "../../shared/Integrations";
import logger from "../../logger";
import { WebClient } from "@slack/web-api";
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry";
import { isFormIntegrationInstallation, isOAuthIntegrationInstallation } from "../../integrations/abstract/Integration";
import { createOAuthStateToken } from "../../utility/oauth";
import { createIntegrationConnectionMessage } from "../../slack/blockKitHelpers";

class SlackChatInterface extends ChatInterface {
    name: string = 'Slack';
    private messageTsToReplace?: string;
    private readonly webClient: WebClient;

    constructor(
        private readonly channel: string,
        webClient: WebClient,
        userId?: string,
        sessionId?: string // thread_ts if in a thread
    ) {
        super(sessionId, userId);
        this.webClient = webClient;
    }

    /**
     * Private helper method to send messages using webClient.
     * Intelligently handles channel vs thread replies based on sessionId.
     */
    private async say(message: string | { text?: string; blocks?: any[]; thread_ts?: string; [key: string]: any }): Promise<void> {
        const payload: any = typeof message === 'string'
            ? { text: message }
            : { ...message };

        // If sessionId exists, we're in a thread - use it as thread_ts
        // Allow explicit thread_ts to override if provided
        if (this.sessionId && !payload.thread_ts) {
            payload.thread_ts = this.sessionId;
        }

        await this.webClient.chat.postMessage({
            channel: this.channel,
            ...payload,
        });
    }

    setMessageTsToReplace(messageTs: string): void {
        this.messageTsToReplace = messageTs;
    }

    async buildPreview(draft: Channel): Promise<string> {
        const { formatChannelPreview } = await import('./PreviewFormatter');
        return formatChannelPreview(draft);
    }

    private async handleFormIntegrationInstallation(integration: IntegrationType): Promise<string> {
        try {
            // Create state payload with chat metadata
            const additionalStatePayload: Record<string, string> | undefined = this.sessionId && this.channel ? {
                chatId: this.sessionId,
                channel: this.channel,
            } : undefined;
            
            const stateToken = createOAuthStateToken({
                userId: this.userId!,
                additionalFields: { integrationType: integration },
                additionalStatePayload,
                expiresIn: "7d",
            });

            // Send a message with a button to open the form modal
            const messagePayload: any = {
                text: `Click the button below to connect ${integration}:`,
                blocks: createIntegrationConnectionMessage(integration, 'form', {
                    stateToken,
                    actionIdPrefix: `open_integration_form_${integration}`,
                }),
            };

            // Add thread_ts if sessionId is available (for thread replies)
            if (this.sessionId) {
                messagePayload.thread_ts = this.sessionId;
            }

            await this.say(messagePayload);

            return `I've sent you a button to connect ${integration}. Click it to fill out the integration form.`;
        } catch (error) {
            logger.error('Error preparing form integration', { error, integration, userId: this.userId });
            return `Failed to prepare integration form for ${integration}. Please try again.`;
        }
    }


    private async handleOAuthIntegrationWithConfig(integration: IntegrationType): Promise<string> {
        try {
            // Configuration required - send button to open configuration modal
            const additionalStatePayload: Record<string, string> | undefined = this.sessionId && this.channel ? {
                chatId: this.sessionId,
                channel: this.channel,
            } : undefined;
            
            const stateToken = createOAuthStateToken({
                userId: this.userId!,
                additionalFields: { integrationType: integration },
                additionalStatePayload,
                expiresIn: "7d",
            });

            // Send a message with a button to open the configuration modal
            const messagePayload: any = {
                text: `Click the button below to connect ${integration}:`,
                blocks: createIntegrationConnectionMessage(integration, 'config', {
                    stateToken,
                    actionIdPrefix: `open_integration_config_${integration}`,
                }),
            };

            // Add thread_ts if sessionId is available (for thread replies)
            if (this.sessionId) {
                messagePayload.thread_ts = this.sessionId;
            }

            await this.say(messagePayload);

            return `I've sent you a button to configure ${integration}. Click it to set up the integration.`;
        } catch (error) {
            logger.error('Error preparing OAuth integration with config', { error, integration, userId: this.userId });
            return `Failed to prepare configuration for ${integration}. Please try again.`;
        }
    }

    private async handleOAuthIntegrationWithoutConfig(integration: IntegrationType, integrationManager: any): Promise<string> {
        try {
            // If WebClient is available, post preliminary message first to get timestamp
            let preliminaryMessageTs: string | undefined;
            if (this.webClient && this.sessionId && this.channel) {
                try {
                    // Post preliminary message to get timestamp
                    const preliminaryResult = await this.webClient.chat.postMessage({
                        channel: this.channel,
                        thread_ts: this.sessionId,
                        text: 'Generating button...',
                    });
                    preliminaryMessageTs = preliminaryResult.ts;
                } catch (error) {
                    logger.error('Failed to post preliminary message for OAuth button', { error, integration, userId: this.userId });
                    // Continue with normal flow
                }
            }

            // Pass additional state payload (sessionId, channel, integrationType, messageTs) to enable resuming ChatAgent after OAuth
            const additionalStatePayload: Record<string, string> | undefined = this.sessionId && this.channel ? {
                chatId: this.sessionId,
                channel: this.channel,
                integrationType: integration,
                ...(preliminaryMessageTs ? { messageTs: preliminaryMessageTs } : {}),
            } : undefined;
            const installationDetails = await integrationManager.getInstallationUrl(this.userId, undefined, additionalStatePayload);
            const oauthUrl = installationDetails.oauthUrl;

            // Send a message with a button block containing the OAuth URL
            const messagePayload: any = {
                text: `Click the button below to connect ${integration}:`,
                blocks: createIntegrationConnectionMessage(integration, 'oauth', {
                    oauthUrl,
                }),
            };

            // Add thread_ts if sessionId is available (for thread replies)
            if (this.sessionId) {
                messagePayload.thread_ts = this.sessionId;
            }

            // If we have a preliminary message, update it; otherwise post new message
            if (preliminaryMessageTs && this.webClient) {
                try {
                    await this.webClient.chat.update({
                        channel: this.channel,
                        ts: preliminaryMessageTs,
                        ...messagePayload,
                    });
                } catch (error) {
                    logger.error('Failed to update preliminary message, falling back to posting new message', { error, integration, userId: this.userId });
                    await this.say(messagePayload);
                }
            } else {
                await this.say(messagePayload);
            }

            return `I've sent you a button to connect ${integration}. Click it to start the authorization process.`;
        } catch (error) {
            logger.error('Error getting installation URL', { error, integration, userId: this.userId });
            return `Failed to get authorization URL for ${integration}. Please try again.`;
        }
    }

    async promptForIntegration(integration: IntegrationType): Promise<string> {
        if (!this.userId) {
            logger.error('Cannot prompt for integration: userId is not available');
            return 'Unable to get authorization URL. Please ensure you are properly authenticated.';
        }

        const integrationManager = INTEGRATION_REGISTRY.find(
            (int) => int.integrationType === integration
        );

        if (!integrationManager) {
            logger.error('Integration not found', { integration });
            return `Integration ${integration} not found.`;
        }

        if (isFormIntegrationInstallation(integrationManager)) {
            return await this.handleFormIntegrationInstallation(integration);
        }

        if (isOAuthIntegrationInstallation(integrationManager)) {
            // Check if this OAuth integration requires configuration
            const configFields = integrationManager.getConfigurationFields();
            
            if (configFields.length > 0) {
                return await this.handleOAuthIntegrationWithConfig(integration);
            }

            // No configuration needed - proceed with existing OAuth flow
            return await this.handleOAuthIntegrationWithoutConfig(integration, integrationManager);
        }

        return `Integration ${integration} does not support installation.`;
    }

    async promptForConfig(config: ConfigType): Promise<string> {
        // Stub implementation - agent uses regular text messages for configuration
        return '';
    }

    async createChannel(channel: Channel): Promise<string> {
        if (!this.userId) {
            logger.error('Cannot create channel: userId is not available');
            return 'Unable to create channel. Please ensure you are properly authenticated.';
        }

        try {
            const { createChannelInternal } = await import('../../routes/channels');
            const result = await createChannelInternal(this.userId, {
                name: channel.name,
                inputs: channel.inputs,
                output: channel.output,
                knowledgeBases: channel.knowledgeBases,
                prompt: channel.prompt,
                isActive: channel.isActive,
                requireApproval: channel.requireApproval,
                notificationSettings: channel.notificationSettings
            });

            // Setup channel inputs (webhooks, etc.)
            const { db } = await import('../../prismaClient');
            const { getInputConfigInclude } = await import('../../utility/prismaIncludes');
            const { setupChannelInputs } = await import('../../routes/channels');

            const prisma = db();
            const channelWithRelations = await prisma.automations.findFirst({
                where: { id: result.id },
                include: {
                    inputs: {
                        include: getInputConfigInclude()
                    },
                }
            });

            if (channelWithRelations) {
                await setupChannelInputs(channelWithRelations);
            }

            return `✅ Successfully created automation "${result.name}" (ID: ${result.id}). The automation is now active and will run according to its configuration.`;
        } catch (error: any) {
            logger.error('Error creating channel from ChatAgent', { error, userId: this.userId });
            return `Failed to create channel: ${error.message || 'Unknown error'}`;
        }
    }

    processStreamEvent(sessionId: string, event: RunStreamEvent): void {
        // Keep this commented out for now, very spammy.
        //logger.debug('Slack chat interface processStreamEvent:', { event });
    }

    async processMessageEnd(sessionId: string, finalOutput: string): Promise<void> {
        logger.info('Slack chat interface processMessageEnd', { messageTsToReplace: this.messageTsToReplace });
        
        // If we have a message timestamp to replace and WebClient, update the message instead of posting new one
        if (this.messageTsToReplace && this.webClient) {
            try {
                await this.webClient.chat.update({
                    channel: this.channel,
                    ts: this.messageTsToReplace,
                    text: finalOutput,
                });
                logger.info('Successfully replaced message', { messageTs: this.messageTsToReplace });
                return;
            } catch (error) {
                logger.error('Failed to update message, falling back to posting new message', { error, messageTs: this.messageTsToReplace });
                // Fall through to post new message
            }
        }
        
        // Default behavior: post new message
        this.say({
            text: finalOutput,
            thread_ts: sessionId,
        });
    }
}

export default SlackChatInterface;
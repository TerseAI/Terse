import { RunStreamEvent } from "@openai/agents";
import { ConfigType } from "../../../shared/Configs";
import ChatInterface from "./ChatInterface";
import { IntegrationType } from "../../../shared/Integrations";
import logger from "../../../logger";
import { Block, ChatPostMessageArguments, ChatUpdateArguments, KnownBlock, WebClient } from "@slack/web-api";
import { INTEGRATION_REGISTRY } from "../../../integrations/abstract/IntegrationRegistry";
import { isFormIntegrationInstallation, isOAuthIntegrationInstallation, OAuthIntegrationInstallation } from "../../../integrations/abstract/Integration";
import { createOAuthStateToken } from "../../../utility/oauth";
import { createActionBlock, createButton, createIntegrationConnectionMessage } from "../../../slack/blockKitHelpers";

class SlackChatInterface extends ChatInterface {
    name: string = 'Slack';
    private messageTsToReplace?: string;
    private readonly webClient: WebClient;
    private readonly slackUserId?: string;

    constructor(
        private readonly channel: string,
        webClient: WebClient,
        userId: string,
        sessionId: string, // thread_ts if in a thread
        slackUserId?: string,
    ) {
        super(sessionId, userId);
        this.webClient = webClient;
        this.slackUserId = slackUserId;
    }

    async getUserTimezone(): Promise<string | null> {
        if (!this.slackUserId) {
            return null;
        }
        try {
            const result = await this.webClient.users.info({ user: this.slackUserId });
            const tz = (result as { user?: { tz?: string } }).user?.tz;
            return tz || null;
        } catch (error) {
            logger.warn('Failed to fetch Slack user timezone', { error, slackUserId: this.slackUserId });
            return null;
        }
    }


    private async say(message: string | SlackMessagePayload): Promise<void> {
        const payload: SlackMessagePayload = typeof message === 'string'
            ? { text: message }
            : { ...message };
        const blocks = payload.blocks ?? [];

        // If sessionId exists, we're in a thread - use it as thread_ts
        // Allow explicit thread_ts to override if provided
        const thread_ts = payload.thread_ts ?? this.sessionId;

        const messageArgs: ChatPostMessageArguments = {
            channel: this.channel,
            text: payload.text ?? "",
            blocks,
            ...(thread_ts ? { thread_ts } : {}),
        };

        await this.webClient.chat.postMessage(messageArgs);
    }

    setMessageTsToReplace(messageTs: string): void {
        this.messageTsToReplace = messageTs;
    }

    async buildButton(label: string, url: string): Promise<void> {
        const actionId = `open_url_${slugifyActionId(label)}`;
        const button = createButton(label, actionId, { url });
        const blocks = [createActionBlock([button])];
        await this.say({
            text: label,
            blocks,
        });
    }

    async navigate(path: string): Promise<void> {
        // For Slack, we can't navigate in-app, so show a button instead
        const frontendUrl = process.env.FRONTEND_URL || '';
        await this.buildButton('View Automation', `${frontendUrl}${path}`);
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
            const messagePayload: SlackMessagePayload = {
                text: `Click the button below to connect ${integration}:`,
                blocks: createIntegrationConnectionMessage(integration, 'form', {
                    stateToken,
                    actionIdPrefix: `open_integration_form_${integration}`,
                }) as SlackBlock[],
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
            const messagePayload: SlackMessagePayload = {
                text: `Click the button below to connect ${integration}:`,
                blocks: createIntegrationConnectionMessage(integration, 'config', {
                    stateToken,
                    actionIdPrefix: `open_integration_config_${integration}`,
                }) as SlackBlock[],
            };

            // Add thread_ts if sessionId is available (for thread replies)
            if (this.sessionId) {
                messagePayload.thread_ts = this.sessionId;
            }

            await this.say(messagePayload);

            let response = `I've sent you a button to configure ${integration}. Click it to set up the integration.`;

            // Add Slack-specific guidance about channel access
            if (integration === IntegrationType.SLACK) {
                response += `\n\nIMPORTANT: After connecting Slack as a bot, you'll need to invite the Terse bot to each channel you want it to access. In the channel, type /invite @Terse. Only channels where the bot has been invited will be available for automations.`;
            }

            return response;
        } catch (error) {
            logger.error('Error preparing OAuth integration with config', { error, integration, userId: this.userId });
            return `Failed to prepare configuration for ${integration}. Please try again.`;
        }
    }

    private async handleOAuthIntegrationWithoutConfig(
        integration: IntegrationType,
        integrationManager: OAuthIntegrationInstallation<IntegrationType>
    ): Promise<string> {
        try {
            if (!this.userId) {
                throw new Error('User ID is required for OAuth installation');
            }
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
            const messagePayload: SlackMessagePayload = {
                text: `Click the button below to connect ${integration}:`,
                blocks: createIntegrationConnectionMessage(integration, 'oauth', {
                    oauthUrl,
                }) as SlackBlock[],
            };

            // Add thread_ts if sessionId is available (for thread replies)
            if (this.sessionId) {
                messagePayload.thread_ts = this.sessionId;
            }

            // If we have a preliminary message, update it; otherwise post new message
            if (preliminaryMessageTs && this.webClient) {
                try {
                    const updateArgs: ChatUpdateArguments = {
                        channel: this.channel,
                        ts: preliminaryMessageTs,
                        text: messagePayload.text ?? "",
                        blocks: messagePayload.blocks ?? [],
                    };
                    await this.webClient.chat.update(updateArgs);
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
        logger.info('Slack chat interface promptForIntegration', { integration, userId: this.userId });
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
        logger.info('Slack chat interface promptForConfig', { config });
        return '';
    }

    processStreamEvent(sessionId: string, event: RunStreamEvent): void {
        // Keep this commented out for now, very spammy.
        //logger.debug('Slack chat interface processStreamEvent:', { event });
    }

    async processMessageEnd(sessionId: string, finalOutput: string): Promise<void> {
        logger.info('Slack chat interface processMessageEnd. Final output:', { messageTsToReplace: this.messageTsToReplace, finalOutput });
        const blocks = buildRichTextBlocks(finalOutput);
        
        // If we have a message timestamp to replace and WebClient, update the message instead of posting new one
        if (this.messageTsToReplace && this.webClient) {
            try {
                await this.webClient.chat.update({
                    channel: this.channel,
                    ts: this.messageTsToReplace,
                    text: finalOutput,
                    blocks,
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
            blocks,
            thread_ts: sessionId,
        });
    }
}

export default SlackChatInterface;

type SlackBlock = KnownBlock | Block;

type SlackMessagePayload = {
    text?: string;
    blocks?: SlackBlock[];
    thread_ts?: string;
};

function makeSectionBlock(text: string): KnownBlock {
    return {
        type: "section",
        text: { type: "mrkdwn", text },
    };
}

function buildRichTextBlocks(text: string): KnownBlock[] {
    const trimmed = text.trim();
    if (!trimmed) {
        return [];
    }
    const normalized = normalizeSlackMrkdwn(trimmed);
    const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim());
    return paragraphs.map((paragraph) => makeSectionBlock(paragraph));
}

function normalizeSlackMrkdwn(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, "*$1*")
        .replace(/__(.+?)__/g, "_$1_")
        .replace(/(^|\n)\s*-\s+/g, "$1• ");
}

function slugifyActionId(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50) || "button";
}
import { RunStreamEvent } from "@openai/agents";
import { ConfigType } from "../../shared/Configs";
import { Channel } from "../../shared/types";
import ChatInterface from "./ChatInterface";
import { IntegrationType } from "../../shared/Integrations";
import logger from "../../logger";
import { Block, ChatPostMessageArguments, ChatUpdateArguments, KnownBlock, WebClient } from "@slack/web-api";
import { INTEGRATION_REGISTRY } from "../../integrations/abstract/IntegrationRegistry";
import { isFormIntegrationInstallation, isOAuthIntegrationInstallation, OAuthIntegrationInstallation } from "../../integrations/abstract/Integration";
import { createOAuthStateToken } from "../../utility/oauth";
import { createIntegrationConnectionMessage } from "../../slack/blockKitHelpers";
import { ChannelDraft } from "../../routes/channels";

class SlackChatInterface extends ChatInterface {
    name: string = 'Slack';
    private messageTsToReplace?: string;
    private readonly webClient: WebClient;
    private readonly slackUserId?: string;

    constructor(
        private readonly channel: string,
        webClient: WebClient,
        userId?: string,
        slackUserId?: string,
        sessionId?: string // thread_ts if in a thread
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

    /**
     * Private helper method to send messages using webClient.
     * Intelligently handles channel vs thread replies based on sessionId.
     */
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

    async buildPreview(draft: ChannelDraft): Promise<string> {
        const blocks: SlackBlock[] = [];
        const title = draft.name?.trim() || "Untitled Automation";
        const status = draft.isActive ? "Active" : "Paused";
        const approval = draft.requireApproval ? "Requires approval" : "No approval";

        blocks.push(makeHeaderBlock(`Preview: ${title}`));

        blocks.push(makeContextBlock([
            `*Status:* ${status}`,
            `*Approval:* ${approval}`,
        ]));

        blocks.push(makeDividerBlock());

        blocks.push(makeSectionBlock("*Inputs*"));

        if (!draft.inputs || draft.inputs.length === 0) {
            blocks.push(makeSectionBlock("_No inputs configured yet._"));
        } else {
            draft.inputs.forEach((input, index) => {
                const summary = formatConfigSummary(input.config as unknown as ConfigSummaryInput);
                blocks.push(makeSectionBlock(`• *${index + 1}.* ${summary}`));
            });
        }

        blocks.push(makeDividerBlock());

        blocks.push(makeSectionBlock("*Output*"));

        if (!draft.output) {
            blocks.push(makeSectionBlock("_No output configured yet._"));
        } else {
            blocks.push(makeSectionBlock(formatConfigSummary(draft.output.config as unknown as ConfigSummaryInput)));
        }

        blocks.push(makeDividerBlock());

        blocks.push(makeSectionBlock("*Knowledge Bases*"));

        if (!draft.knowledgeBases || draft.knowledgeBases.length === 0) {
            blocks.push(makeSectionBlock("_No knowledge bases configured._"));
        } else {
            draft.knowledgeBases.forEach((kb, index) => {
                const summary = formatConfigSummary(kb.config as unknown as ConfigSummaryInput);
                blocks.push(makeSectionBlock(`• *${index + 1}.* ${summary}`));
            });
        }

        blocks.push(makeDividerBlock());

        blocks.push(makeSectionBlock("*Prompt*"));

        const promptText = draft.prompt?.text?.trim();
        blocks.push(makeSectionBlock(promptText ? truncateText(promptText, 600) : "_No prompt provided._"));

        await this.say({
            text: `Preview for ${title}`,
            blocks
        });

        return "Preview sent.";
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

            return `I've sent you a button to configure ${integration}. Click it to set up the integration.`;
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

type SlackBlock = KnownBlock | Block;

type SlackMessagePayload = {
    text?: string;
    blocks?: SlackBlock[];
    thread_ts?: string;
};

type ConfigSummaryInput = Record<string, unknown> & {
    configType?: ConfigType;
    integrationType?: IntegrationType;
    integrationId?: string;
    repositoryIds?: number[];
    repositoryNames?: string[];
    channelName?: string;
    channelId?: string;
    listenToUserDms?: boolean;
    fileName?: string;
    fileKey?: string;
    teamId?: string;
    databaseName?: string;
    databaseId?: string;
    pageName?: string;
    pageId?: string;
    projectName?: string;
    projectId?: string;
    projectKey?: string;
    spaceName?: string;
    cronExpression?: string;
};

function makeHeaderBlock(text: string): KnownBlock {
    return {
        type: "header",
        text: { type: "plain_text", text },
    };
}

function makeContextBlock(texts: string[]): KnownBlock {
    return {
        type: "context",
        elements: texts.map((text) => ({ type: "mrkdwn", text })),
    };
}

function makeDividerBlock(): KnownBlock {
    return { type: "divider" };
}

function makeSectionBlock(text: string): KnownBlock {
    return {
        type: "section",
        text: { type: "mrkdwn", text },
    };
}

function formatConfigSummary(config: ConfigSummaryInput): string {
    const configData = config;
    const configType = configData.configType ?? ConfigType.GMAIL;
    const integrationType = configData.integrationType ?? IntegrationType.TERSE;
    const parts: string[] = [];

    switch (configType) {
        case ConfigType.TIME_TRIGGER:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.cronExpression) parts.push(`cron: \`${config.cronExpression}\``);
            break;
        case ConfigType.FIGMA:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.fileName) parts.push(`file: ${config.fileName}`);
            if (config.fileKey) parts.push(`fileKey: ${config.fileKey}`);
            if (config.teamId) parts.push(`teamId: ${config.teamId}`);
            break;
        case ConfigType.SLACK:
        case ConfigType.SLACK_OUTPUT:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.channelName) parts.push(`channel: ${config.channelName}`);
            if (config.channelId) parts.push(`channelId: ${config.channelId}`);
            if (config.listenToUserDms) parts.push(`DMs: yes`);
            break;
        case ConfigType.GITHUB:
        case ConfigType.GITHUB_KB:
            parts.push(`*${configType}* (${integrationType})`);
            if (Array.isArray(config.repositoryIds) && config.repositoryIds.length > 0) {
                parts.push(`repos: ${config.repositoryIds.join(', ')}`);
            }
            if (Array.isArray(config.repositoryNames) && config.repositoryNames.length > 0) {
                parts.push(`names: ${config.repositoryNames.join(', ')}`);
            }
            break;
        case ConfigType.NOTION_DATABASE:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.databaseName) parts.push(`database: ${config.databaseName}`);
            if (config.databaseId) parts.push(`databaseId: ${config.databaseId}`);
            break;
        case ConfigType.NOTION_PAGE:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.pageName) parts.push(`page: ${config.pageName}`);
            if (config.pageId) parts.push(`pageId: ${config.pageId}`);
            break;
        case ConfigType.LINEAR_INPUT:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.projectName) parts.push(`project: ${config.projectName}`);
            if (config.projectId) parts.push(`projectId: ${config.projectId}`);
            break;
        case ConfigType.LINEAR_OUTPUT:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.teamId) parts.push(`teamId: ${config.teamId}`);
            if (config.teamName) parts.push(`team: ${config.teamName}`);
            break;
        case ConfigType.CONFLUENCE:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.spaceName) parts.push(`space: ${config.spaceName}`);
            if (config.pageName) parts.push(`page: ${config.pageName}`);
            if (config.pageId) parts.push(`pageId: ${config.pageId}`);
            break;
        case ConfigType.JIRA:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.projectKey) parts.push(`projectKey: ${config.projectKey}`);
            if (config.projectId) parts.push(`projectId: ${config.projectId}`);
            break;
        case ConfigType.POSTHOG:
            parts.push(`*${configType}* (${integrationType})`);
            if (config.projectName) parts.push(`project: ${config.projectName}`);
            if (config.projectId) parts.push(`projectId: ${config.projectId}`);
            break;
        default:
            parts.push(`*${configType}* (${integrationType})`);
            break;
    }

    if (configData.integrationId) {
        parts.push(`integrationId: ${configData.integrationId}`);
    }

    return parts.join(' · ');
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 3)}...`;
}
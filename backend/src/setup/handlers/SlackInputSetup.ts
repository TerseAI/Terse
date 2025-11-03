import { InputSetupHandler } from '../AutomationInputSetup';
import { WebClient, LogLevel } from '@slack/web-api';
import { db } from '../../prismaClient';
import { IntegrationType } from '@prisma/client';
import chalk from 'chalk';

/**
 * Slack input setup handler.
 * Ensures the bot joins channels specified in automations.
 */
export class SlackInputSetup implements InputSetupHandler {
    async setup(integrationId: string, automationInput: any): Promise<void> {
        const channelId = automationInput.slack_config?.channel_id;

        // Get Slack integration
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: { id: integrationId },
            include: { slack_integration: true },
        });

        if (!userSlackIntegration?.slack_integration) {
            console.log(chalk.yellow(`⚠️  Slack integration not found: ${integrationId}`));
            return;
        }

        const integration = userSlackIntegration.slack_integration;
        const client = new WebClient(integration.access_token, {
            logLevel: LogLevel.ERROR,
        });

        // If a specific channel is configured, ensure bot is in that channel
        if (channelId) {
            await this.ensureBotInChannel(client, channelId);
        }
    }

    async tearDown(integrationId: string, automationInput: any): Promise<void> {
        const channelId = automationInput.slack_config?.channel_id;

        // Check if any other active automations are using this channel
        if (channelId) {
            const otherAutomations = await db().automation_inputs.findMany({
                where: {
                    integration_type: IntegrationType.SLACK,
                    automation: {
                        is_active: true,
                    },
                    NOT: {
                        id: automationInput.id,
                    },
                },
                include: {
                    slack_config: true,
                },
            });

            const stillInUse = otherAutomations.some(
                (input) => input.slack_config?.channel_id === channelId
            );

            if (!stillInUse) {
                console.log(chalk.blue(`📤 Channel ${channelId} no longer needed by any automations`));
            }
        }
    }

    private async ensureBotInChannel(client: WebClient, channelId: string): Promise<void> {
        try {
            const authResult = await client.auth.test();
            if (!authResult.ok || !authResult.user_id) {
                console.log(chalk.yellow('⚠️  Could not get bot user ID'));
                return;
            }

            const botUserId = authResult.user_id;
            const channelInfo = await client.conversations.info({ channel: channelId });

            if (!channelInfo.ok || !channelInfo.channel) {
                console.log(chalk.yellow(`⚠️  Could not get channel info for ${channelId}`));
                return;
            }

            const members = (channelInfo.channel as any).members || [];
            const isBotInChannel = members.includes(botUserId);

            if (!isBotInChannel) {
                if (channelInfo.channel.is_private || channelInfo.channel.is_im || channelInfo.channel.is_mpim) {
                    console.log(chalk.yellow(`⚠️  Bot must be invited to private channel/DM: ${channelId}`));
                } else {
                    const joinResult = await client.conversations.join({ channel: channelId });
                    if (joinResult.ok) {
                        console.log(chalk.green(`✅ Bot joined channel: ${channelId}`));
                    } else {
                        console.log(chalk.yellow(`⚠️  Could not join channel ${channelId}: ${joinResult.error}`));
                    }
                }
            } else {
                console.log(chalk.blue(`ℹ️  Bot already in channel: ${channelId}`));
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error ensuring bot in channel ${channelId}:`), error);
        }
    }
}

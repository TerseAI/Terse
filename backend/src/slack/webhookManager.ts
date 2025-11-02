import chalk from 'chalk';
import { WebClient, LogLevel } from '@slack/web-api';
import { db } from '../prismaClient';
import { IntegrationType } from '@prisma/client';

/**
 * Manages Slack webhook subscriptions for automations.
 * When a Slack automation is created, this ensures the bot is set up
 * to receive events for the specified channels.
 */
export class SlackWebhookManager {
    /**
     * Called when a Slack automation is created.
     * Ensures the bot joins the specified channel (if configured).
     */
    static async setupAutomationWebhook(
        slackIntegrationId: string,
        channelId?: string | null
    ): Promise<void> {
        try {
            const slackIntegration = await db().slack_integrations.findFirst({
                where: {
                    team_id: slackIntegrationId // Note: integrationId might be team_id or user_slack_integration.id
                }
            });

            // Also try finding by user_slack_integrations.id
            let integration = slackIntegration;
            if (!integration) {
                const userSlackIntegration = await db().user_slack_integrations.findFirst({
                    where: { id: slackIntegrationId },
                    include: { slack_integration: true }
                });
                if (userSlackIntegration?.slack_integration) {
                    integration = userSlackIntegration.slack_integration;
                }
            }

            if (!integration) {
                console.log(chalk.yellow(`⚠️  Slack integration not found: ${slackIntegrationId}`));
                return;
            }

            const client = new WebClient(integration.access_token, {
                logLevel: LogLevel.ERROR,
            });

            // If a specific channel is configured, ensure bot is in that channel
            if (channelId) {
                await this.ensureBotInChannel(client, channelId);
            }

            console.log(chalk.green(`✅ Slack webhook configured for automation`));
        } catch (error) {
            console.error(chalk.red('❌ Error setting up Slack webhook:'), error);
            // Don't throw - webhook setup failure shouldn't break automation creation
        }
    }

    /**
     * Called when a Slack automation is deleted.
     * Optionally leaves channels if no other automations need them.
     */
    static async tearDownAutomationWebhook(
        slackIntegrationId: string,
        channelId?: string | null
    ): Promise<void> {
        try {
            const slackIntegration = await db().slack_integrations.findFirst({
                where: {
                    team_id: slackIntegrationId
                }
            });

            let integration = slackIntegration;
            if (!integration) {
                const userSlackIntegration = await db().user_slack_integrations.findFirst({
                    where: { id: slackIntegrationId },
                    include: { slack_integration: true }
                });
                if (userSlackIntegration?.slack_integration) {
                    integration = userSlackIntegration.slack_integration;
                }
            }

            if (!integration) {
                return;
            }

            // Check if any other active automations are using this channel
            if (channelId) {
                const otherAutomations = await db().automation_inputs.findMany({
                    where: {
                        integration_type: IntegrationType.SLACK,
                        automation: {
                            is_active: true,
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
                    // Note: We could leave the channel here, but it's often better to stay
                    // in channels in case the user creates another automation later
                }
            }

            console.log(chalk.green(`✅ Slack webhook teardown completed`));
        } catch (error) {
            console.error(chalk.red('❌ Error tearing down Slack webhook:'), error);
        }
    }

    /**
     * Ensures the bot user is a member of the specified channel.
     * This is necessary for the bot to receive message events.
     */
    private static async ensureBotInChannel(
        client: WebClient,
        channelId: string
    ): Promise<void> {
        try {
            // Get bot user ID
            const authResult = await client.auth.test();
            if (!authResult.ok || !authResult.user_id) {
                console.log(chalk.yellow('⚠️  Could not get bot user ID'));
                return;
            }

            const botUserId = authResult.user_id;

            // Check if bot is already in the channel
            const channelInfo = await client.conversations.info({
                channel: channelId,
            });

            if (!channelInfo.ok || !channelInfo.channel) {
                console.log(chalk.yellow(`⚠️  Could not get channel info for ${channelId}`));
                return;
            }

            const members = channelInfo.channel.members || [];
            const isBotInChannel = members.includes(botUserId);

            if (!isBotInChannel) {
                // Try to join the channel
                // Note: For public channels, we use conversations.join
                // For private channels/DMs, the bot must be invited
                if (channelInfo.channel.is_private || channelInfo.channel.is_im || channelInfo.channel.is_mpim) {
                    console.log(chalk.yellow(`⚠️  Bot must be invited to private channel/DM: ${channelId}`));
                } else {
                    const joinResult = await client.conversations.join({
                        channel: channelId,
                    });

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
            // Don't throw - channel join failure shouldn't break automation creation
        }
    }

    /**
     * Called during initialization to ensure message events are subscribed.
     * This should be called when the app starts or when Slack integration is set up.
     */
    static async ensureMessageEventsSubscribed(): Promise<void> {
        // Note: Slack event subscriptions are configured at the app level via manifest
        // or through the Slack API's apps.eventSubscriptions.update method.
        // For most apps, this is configured once in the manifest.
        
        console.log(chalk.blue('ℹ️  Ensure "message" event is subscribed in Slack app manifest'));
        console.log(chalk.blue('   Update slack_manifest.json bot_events to include "message"'));
    }
}

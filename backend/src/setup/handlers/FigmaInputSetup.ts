import { InputSetupHandler } from '../AutomationInputSetup';
import { db } from '../../prismaClient';
import { IntegrationType } from '@prisma/client';
import chalk from 'chalk';
import { generateWebhookPasscode } from '../../utility/webhookSecrets';

/**
 * Figma input setup handler.
 * Creates webhooks for Figma files when automations are set up.
 */
export class FigmaInputSetup implements InputSetupHandler {
    async setup(integrationId: string, automationInput: any): Promise<void> {
        // Check if figma_config exists at all
        if (!automationInput.figma_config) {
            console.log(chalk.yellow(`⚠️  No Figma config found for input ${automationInput.id}. Skipping webhook setup.`));
            return;
        }

        const fileKey = automationInput.figma_config.file_key;
        
        if (!fileKey) {
            console.log(chalk.yellow(`⚠️  No file_key specified in Figma config for input ${automationInput.id}`));
            return;
        }

        // Get Figma integration
        const figmaIntegration = await db().figma_integrations.findFirst({
            where: { id: integrationId },
        });

        if (!figmaIntegration) {
            console.log(chalk.yellow(`⚠️  Figma integration not found: ${integrationId}`));
            return;
        }

        // Get team ID from config - required for webhook creation
        const teamId = automationInput.figma_config.team_id;

        if (!teamId) {
            throw new Error(`team_id is required for creating Figma webhooks. Please provide a team ID in the Figma configuration for file ${fileKey}.`);
        }

        // Build webhook endpoint URL
        const webhookEndpoint = `${process.env.BACKEND_URL || 'http://localhost:3001'}/webhooks/figma`;

        // Event types to monitor: comments and file design changes
        const eventTypes = ['FILE_COMMENT', 'FILE_UPDATE'];

        try {
            const accessToken = figmaIntegration.access_token;
            const isDevelopment = process.env.NODE_ENV !== 'production';

            // Create or reuse team-level webhooks for both event types
            for (const eventType of eventTypes) {
                // Check if a team-level webhook already exists for this team and event type
                const existingWebhook = await db().figma_webhooks.findFirst({
                    where: {
                        figma_integration_id: figmaIntegration.id,
                        team_id: teamId,
                        event_type: eventType,
                    },
                });

                // In development, always delete and recreate webhooks
                if (isDevelopment && existingWebhook) {
                    console.log(
                        chalk.yellow(`🔄 Development mode: Deleting existing webhook ${existingWebhook.webhook_id} for team ${teamId}, event ${eventType}`)
                    );
                    
                    // Delete webhook from Figma API
                    try {
                        const deleteResponse = await fetch(`https://api.figma.com/v2/webhooks/${existingWebhook.webhook_id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                            },
                        });

                        if (!deleteResponse.ok && deleteResponse.status !== 404) {
                            const errorText = await deleteResponse.text();
                            console.error(chalk.red(`Failed to delete existing Figma webhook ${existingWebhook.webhook_id}: ${errorText}`));
                        } else {
                            console.log(chalk.green(`✅ Deleted existing webhook ${existingWebhook.webhook_id}`));
                        }
                    } catch (error) {
                        console.error(chalk.red(`❌ Error deleting existing webhook ${existingWebhook.webhook_id}:`), error);
                    }

                    // Delete webhook record from database
                    await db().figma_webhooks.delete({
                        where: { id: existingWebhook.id },
                    });
                } else if (existingWebhook) {
                    // In production, reuse existing webhook
                    console.log(
                        chalk.blue(`ℹ️  Team-level webhook already exists for team ${teamId}, event ${eventType}. Reusing existing webhook ${existingWebhook.webhook_id}`)
                    );
                    continue; // Webhook already exists, skip creation
                }

                // Generate secure passcode for webhook verification
                const passcode = generateWebhookPasscode();

                // Create team-level webhook (no file_key - monitors entire team)
                const webhookResponse = await fetch('https://api.figma.com/v2/webhooks', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        event_type: eventType,
                        team_id: teamId,
                        // No file_key - this is a team-level webhook
                        endpoint: webhookEndpoint,
                        passcode: passcode,
                    }),
                });

                if (!webhookResponse.ok) {
                    const errorText = await webhookResponse.text();
                    console.error(chalk.red(`Failed to create Figma webhook for ${eventType}: ${errorText}`));
                    throw new Error(`Failed to create Figma webhook for ${eventType}: ${errorText}`);
                }

                const webhookData = await webhookResponse.json();
                const webhookId = webhookData.webhook?.id || webhookData.id;

                if (!webhookId) {
                    throw new Error(`Webhook ID not returned from Figma API for ${eventType}`);
                }

                // Store team-level webhook in database
                await db().figma_webhooks.create({
                    data: {
                        figma_integration_id: figmaIntegration.id,
                        automation_input_id: automationInput.id, // Track which automation created it (but webhook is shared)
                        webhook_id: webhookId,
                        team_id: teamId,
                        endpoint_url: webhookEndpoint,
                        passcode: passcode,
                        event_type: eventType,
                    },
                });

                console.log(
                    chalk.green(`✅ Created team-level Figma webhook ${webhookId} for team ${teamId}, event ${eventType}`)
                );
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error creating Figma webhooks for team ${teamId}:`), error);
            throw error;
        }
    }

    async tearDown(integrationId: string, automationInput: any): Promise<void> {
        const teamId = automationInput.figma_config?.team_id;

        if (!teamId) {
            console.log(chalk.blue(`ℹ️  No team_id in config, skipping webhook cleanup for automation input ${automationInput.id}`));
            return;
        }

        // Get Figma integration
        const figmaIntegration = await db().figma_integrations.findFirst({
            where: { id: integrationId },
        });

        if (!figmaIntegration) {
            console.log(chalk.yellow(`⚠️  Figma integration not found: ${integrationId}`));
            return;
        }

        // Check if any other active automations are using this team
        const otherAutomations = await db().automation_inputs.findMany({
            where: {
                integration_type: IntegrationType.FIGMA,
                automation: {
                    is_active: true,
                },
                NOT: {
                    id: automationInput.id,
                },
            },
            include: {
                figma_config: true,
            },
        });

        // Check if any other active automation uses the same team
        const otherTeamUsers = otherAutomations.filter(
            (input) => input.figma_config?.team_id === teamId
        );

        if (otherTeamUsers.length > 0) {
            console.log(
                chalk.blue(`ℹ️  Team ${teamId} still in use by ${otherTeamUsers.length} other automation(s). Keeping team-level webhooks.`)
            );
            return; // Don't delete webhooks, other automations are using them
        }

        // No other automations use this team, so we can delete the team-level webhooks
        const webhooks = await db().figma_webhooks.findMany({
            where: {
                figma_integration_id: figmaIntegration.id,
                team_id: teamId,
            },
        });

        if (webhooks.length === 0) {
            console.log(chalk.blue(`ℹ️  No webhooks found for team ${teamId}`));
            return;
        }

        const accessToken = figmaIntegration.access_token;
        if (!accessToken) {
            console.log(chalk.yellow(`⚠️  No access token found, skipping webhook deletion`));
            return;
        }

        // Delete all team-level webhooks for this team
        for (const webhook of webhooks) {
            try {
                const deleteResponse = await fetch(`https://api.figma.com/v2/webhooks/${webhook.webhook_id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });

                if (!deleteResponse.ok && deleteResponse.status !== 404) {
                    // 404 means webhook already deleted, which is fine
                    const errorText = await deleteResponse.text();
                    console.error(chalk.red(`Failed to delete Figma webhook ${webhook.webhook_id} (${webhook.event_type}): ${errorText}`));
                } else {
                    console.log(chalk.green(`✅ Deleted team-level Figma webhook ${webhook.webhook_id} (${webhook.event_type}) for team ${teamId}`));
                }
            } catch (error) {
                console.error(chalk.red(`❌ Error deleting Figma webhook ${webhook.webhook_id}:`), error);
                // Continue with database cleanup even if API call fails
            }
        }

        // Delete webhook records from database
        await db().figma_webhooks.deleteMany({
            where: {
                figma_integration_id: figmaIntegration.id,
                team_id: teamId,
            },
        });

        console.log(chalk.blue(`📤 Team ${teamId} no longer monitored by any automations`));
    }
}


import { InputSetupHandler } from '../AutomationInputSetup';
import { db } from '../../prismaClient';
import { IntegrationType } from '@prisma/client';
import chalk from 'chalk';

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

        // Check if webhook already exists for this automation input
        const existingWebhook = await db().figma_webhooks.findUnique({
            where: { automation_input_id: automationInput.id },
        });

        if (existingWebhook) {
            console.log(chalk.blue(`ℹ️  Webhook already exists for automation input ${automationInput.id}`));
            return;
        }

        // Get team ID from config - required for webhook creation
        const teamId = automationInput.figma_config.team_id;

        if (!teamId) {
            throw new Error(`team_id is required for creating Figma webhooks. Please provide a team ID in the Figma configuration for file ${fileKey}.`);
        }

        // Build webhook endpoint URL
        const webhookEndpoint = `${process.env.BACKEND_URL || process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:3001'}/webhooks/figma`;

        try {
            const accessToken = figmaIntegration.access_token;

            // Create webhook in Figma
            // Note: Figma webhooks can be created at team or file level
            // For file-level monitoring, we use the file_key
            const webhookResponse = await fetch('https://api.figma.com/v2/webhooks', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event_type: 'FILE_UPDATE',
                    team_id: teamId,
                    file_key: fileKey, // File to monitor
                    endpoint: webhookEndpoint,
                }),
            });

            if (!webhookResponse.ok) {
                const errorText = await webhookResponse.text();
                console.error(chalk.red(`Failed to create Figma webhook: ${errorText}`));
                throw new Error(`Failed to create Figma webhook: ${errorText}`);
            }

            const webhookData = await webhookResponse.json();
            const webhookId = webhookData.webhook?.id || webhookData.id;

            if (!webhookId) {
                throw new Error('Webhook ID not returned from Figma API');
            }

            // Store webhook in database
            await db().figma_webhooks.create({
                data: {
                    figma_integration_id: figmaIntegration.id,
                    automation_input_id: automationInput.id,
                    webhook_id: webhookId,
                    file_key: fileKey,
                    team_id: teamId,
                    endpoint_url: webhookEndpoint,
                },
            });

            console.log(
                chalk.green(`✅ Created Figma webhook ${webhookId} for file ${fileKey} (automation input ${automationInput.id})`)
            );
        } catch (error) {
            console.error(chalk.red(`❌ Error creating Figma webhook for file ${fileKey}:`), error);
            throw error;
        }
    }

    async tearDown(integrationId: string, automationInput: any): Promise<void> {
        const fileKey = automationInput.figma_config?.file_key;

        // Find the webhook for this automation input
        const webhook = await db().figma_webhooks.findUnique({
            where: { automation_input_id: automationInput.id },
            include: {
                figma_integration: true,
            },
        });

        if (!webhook) {
            console.log(chalk.blue(`ℹ️  No webhook found for automation input ${automationInput.id}`));
            return;
        }

        // Check if any other active automations are using this file
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

        const stillInUse = otherAutomations.some(
            (input) => input.figma_config?.file_key === fileKey
        );

        // Always delete the webhook - each automation input gets its own webhook
        try {
            const accessToken = webhook.figma_integration.access_token;

            const deleteResponse = await fetch(`https://api.figma.com/v2/webhooks/${webhook.webhook_id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!deleteResponse.ok && deleteResponse.status !== 404) {
                // 404 means webhook already deleted, which is fine
                const errorText = await deleteResponse.text();
                console.error(chalk.red(`Failed to delete Figma webhook: ${errorText}`));
            } else {
                console.log(chalk.green(`✅ Deleted Figma webhook ${webhook.webhook_id}`));
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error deleting Figma webhook ${webhook.webhook_id}:`), error);
            // Continue with database cleanup even if API call fails
        }

        // Delete webhook record from database
        await db().figma_webhooks.delete({
            where: { id: webhook.id },
        });

        if (!stillInUse) {
            console.log(chalk.blue(`📤 File ${fileKey} no longer monitored by any automations`));
        }
    }
}


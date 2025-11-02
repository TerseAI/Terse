import { WebhookHandler } from '../WebhookManager';
import { db } from '../../prismaClient';
import chalk from 'chalk';

/**
 * Linear webhook handler.
 * 
 * Note: Linear webhooks are configured at the integration level (when the API key is set),
 * not per-automation. However, we check here to ensure webhooks exist.
 */
export class LinearWebhookHandler implements WebhookHandler {
    async setupWebhook(integrationId: string, automationInput: any): Promise<void> {
        // Linear webhooks are configured at the integration level (in setLinearApiKey),
        // so we just verify the webhook exists
        const linearKey = await db().linear_api_keys.findFirst({
            where: { id: integrationId },
        });

        if (!linearKey) {
            console.log(chalk.yellow(`⚠️  Linear integration not found: ${integrationId}`));
            return;
        }

        if (!linearKey.webhook_id) {
            console.log(chalk.yellow(`⚠️  Linear integration ${integrationId} has no webhook configured`));
            console.log(chalk.blue('   Linear webhooks should be set up when the integration is created'));
        } else {
            console.log(chalk.blue(`ℹ️  Linear webhook already configured for integration: ${integrationId}`));
        }
    }

    async tearDownWebhook(integrationId: string, automationInput: any): Promise<void> {
        // Linear webhooks are managed at the integration level, not per-automation.
        // We don't tear down webhooks when automations are deleted, only when the integration is deleted.
        console.log(chalk.blue(`ℹ️  Linear webhook remains active (managed at integration level)`));
    }
}

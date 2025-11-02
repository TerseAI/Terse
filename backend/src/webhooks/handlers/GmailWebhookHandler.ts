import { WebhookHandler } from '../WebhookManager';
import { db } from '../../prismaClient';
import chalk from 'chalk';

/**
 * Gmail webhook handler.
 * 
 * Note: Gmail uses Google Pub/Sub for webhooks, which is configured at the integration level.
 */
export class GmailWebhookHandler implements WebhookHandler {
    async setupWebhook(integrationId: string, automationInput: any): Promise<void> {
        // Gmail webhooks (Pub/Sub subscriptions) are configured at the integration level
        const gmailIntegration = await db().gmail_integrations.findFirst({
            where: { id: integrationId },
        });

        if (!gmailIntegration) {
            console.log(chalk.yellow(`⚠️  Gmail integration not found: ${integrationId}`));
            return;
        }

        console.log(chalk.blue(`ℹ️  Gmail webhook (Pub/Sub) managed at integration level: ${integrationId}`));
    }

    async tearDownWebhook(integrationId: string, automationInput: any): Promise<void> {
        // Gmail webhooks are managed at the integration level
        console.log(chalk.blue(`ℹ️  Gmail webhook remains active (managed at integration level)`));
    }
}

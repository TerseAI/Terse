import { WebhookHandler } from '../WebhookManager';
import chalk from 'chalk';

/**
 * Notion webhook handler.
 * 
 * Note: Notion doesn't currently have webhook support in the same way.
 * Events may be polled or handled differently.
 */
export class NotionWebhookHandler implements WebhookHandler {
    async setupWebhook(integrationId: string, automationInput: any): Promise<void> {
        // Notion webhooks are not currently supported in the standard way
        console.log(chalk.blue(`ℹ️  Notion webhooks not currently supported`));
    }

    async tearDownWebhook(integrationId: string, automationInput: any): Promise<void> {
        // Notion webhooks are not currently supported
        console.log(chalk.blue(`ℹ️  Notion webhook teardown not applicable`));
    }
}

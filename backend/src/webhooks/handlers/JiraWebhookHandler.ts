import { WebhookHandler } from '../WebhookManager';
import { db } from '../../prismaClient';
import chalk from 'chalk';

/**
 * Jira webhook handler.
 * 
 * Note: Jira webhooks are configured at the integration level (when credentials are set),
 * not per-automation. However, we check here to ensure webhooks exist.
 */
export class JiraWebhookHandler implements WebhookHandler {
    async setupWebhook(integrationId: string, automationInput: any): Promise<void> {
        // Jira webhooks are configured at the integration level (in setJiraCredentials),
        // so we just verify the webhook exists
        const jiraKey = await db().jira_api_keys.findFirst({
            where: { id: integrationId },
        });

        if (!jiraKey) {
            console.log(chalk.yellow(`⚠️  Jira integration not found: ${integrationId}`));
            return;
        }

        if (!jiraKey.webhook_id) {
            console.log(chalk.yellow(`⚠️  Jira integration ${integrationId} has no webhook configured`));
            console.log(chalk.blue('   Jira webhooks should be set up when the integration is created'));
        } else {
            console.log(chalk.blue(`ℹ️  Jira webhook already configured for integration: ${integrationId}`));
        }
    }

    async tearDownWebhook(integrationId: string, automationInput: any): Promise<void> {
        // Jira webhooks are managed at the integration level, not per-automation.
        // We don't tear down webhooks when automations are deleted, only when the integration is deleted.
        console.log(chalk.blue(`ℹ️  Jira webhook remains active (managed at integration level)`));
    }
}

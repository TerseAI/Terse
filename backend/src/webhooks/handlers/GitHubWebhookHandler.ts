import { WebhookHandler } from '../WebhookManager';
import chalk from 'chalk';

/**
 * GitHub webhook handler.
 * 
 * Note: GitHub webhooks are configured via the GitHub App installation,
 * not per-automation or per-repository.
 */
export class GitHubWebhookHandler implements WebhookHandler {
    async setupWebhook(integrationId: string, automationInput: any): Promise<void> {
        // GitHub webhooks are configured via GitHub App installation.
        // The GitHub App receives webhooks for all repositories it has access to.
        console.log(chalk.blue(`ℹ️  GitHub webhooks are managed via GitHub App installation`));
    }

    async tearDownWebhook(integrationId: string, automationInput: any): Promise<void> {
        // GitHub webhooks are managed at the app installation level
        console.log(chalk.blue(`ℹ️  GitHub webhook remains active (managed at app installation level)`));
    }
}

import chalk from 'chalk';
import { IntegrationType } from '@prisma/client';
import { db } from '../prismaClient';
import { SlackWebhookHandler } from './handlers/SlackWebhookHandler';
import { LinearWebhookHandler } from './handlers/LinearWebhookHandler';
import { JiraWebhookHandler } from './handlers/JiraWebhookHandler';
import { GmailWebhookHandler } from './handlers/GmailWebhookHandler';
import { GitHubWebhookHandler } from './handlers/GitHubWebhookHandler';
import { NotionWebhookHandler } from './handlers/NotionWebhookHandler';

/**
 * General-purpose webhook manager that handles webhook setup/teardown
 * for automations across all integration types.
 */
export class WebhookManager {
    private static handlers = new Map<IntegrationType, WebhookHandler>([
        [IntegrationType.SLACK, new SlackWebhookHandler()],
        [IntegrationType.LINEAR, new LinearWebhookHandler()],
        [IntegrationType.JIRA, new JiraWebhookHandler()],
        [IntegrationType.GMAIL, new GmailWebhookHandler()],
        [IntegrationType.GITHUB, new GitHubWebhookHandler()],
        [IntegrationType.NOTION, new NotionWebhookHandler()],
    ]);

    /**
     * Sets up webhooks for all inputs in an automation.
     * Called after an automation is created or updated.
     */
    static async setupAutomationWebhooks(
        automationId: string
    ): Promise<void> {
        try {
            const automation = await db().automations.findUnique({
                where: { id: automationId },
                include: {
                    inputs: {
                        include: {
                            slack_config: true,
                            linear_config: true,
                            jira_config: true,
                            gmail_config: true,
                            github_config: true,
                            notion_config: true,
                        },
                    },
                },
            });

            if (!automation) {
                console.log(chalk.yellow(`⚠️  Automation not found: ${automationId}`));
                return;
            }

            for (const input of automation.inputs) {
                const handler = this.handlers.get(input.integration_type);
                if (handler) {
                    try {
                        await handler.setupWebhook(input.integration_id, input);
                        console.log(
                            chalk.green(
                                `✅ Webhook setup completed for ${input.integration_type} input (ID: ${input.id})`
                            )
                        );
                    } catch (error) {
                        console.error(
                            chalk.red(
                                `❌ Error setting up webhook for ${input.integration_type} input (ID: ${input.id}):`
                            ),
                            error
                        );
                        // Continue with other inputs even if one fails
                    }
                } else {
                    console.log(
                        chalk.yellow(
                            `⚠️  No webhook handler for integration type: ${input.integration_type} (this is OK if webhooks aren't needed)`
                        )
                    );
                }
            }
        } catch (error) {
            console.error(chalk.red('❌ Error in setupAutomationWebhooks:'), error);
            // Don't throw - webhook setup failures shouldn't break automation creation
        }
    }

    /**
     * Tears down webhooks for all inputs in an automation.
     * Called before an automation is deleted.
     */
    static async tearDownAutomationWebhooks(
        automationId: string
    ): Promise<void> {
        try {
            const automation = await db().automations.findUnique({
                where: { id: automationId },
                include: {
                    inputs: {
                        include: {
                            slack_config: true,
                            linear_config: true,
                            jira_config: true,
                            gmail_config: true,
                            github_config: true,
                            notion_config: true,
                        },
                    },
                },
            });

            if (!automation) {
                return;
            }

            for (const input of automation.inputs) {
                const handler = this.handlers.get(input.integration_type);
                if (handler) {
                    try {
                        await handler.tearDownWebhook(input.integration_id, input);
                        console.log(
                            chalk.green(
                                `✅ Webhook teardown completed for ${input.integration_type} input`
                            )
                        );
                    } catch (error) {
                        console.error(
                            chalk.red(
                                `❌ Error tearing down webhook for ${input.integration_type}:`
                            ),
                            error
                        );
                        // Continue with other inputs even if one fails
                    }
                }
            }
        } catch (error) {
            console.error(chalk.red('❌ Error in tearDownAutomationWebhooks:'), error);
            // Don't throw - webhook teardown failures shouldn't break automation deletion
        }
    }
}

/**
 * Interface for integration-specific webhook handlers.
 * Each integration type implements this interface to handle its own webhook logic.
 */
export interface WebhookHandler {
    /**
     * Sets up webhooks for the given integration and automation input.
     * @param integrationId The ID of the integration (e.g., user_slack_integrations.id, linear_api_keys.id)
     * @param automationInput The automation input with its config
     */
    setupWebhook(integrationId: string, automationInput: any): Promise<void>;

    /**
     * Tears down webhooks for the given integration and automation input.
     * @param integrationId The ID of the integration
     * @param automationInput The automation input with its config
     */
    tearDownWebhook(integrationId: string, automationInput: any): Promise<void>;
}

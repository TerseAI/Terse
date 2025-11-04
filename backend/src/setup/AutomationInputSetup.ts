import chalk from 'chalk';
import { IntegrationType } from '@prisma/client';
import { db } from '../prismaClient';
import { SlackInputSetup } from './handlers/SlackInputSetup';
import { FigmaInputSetup } from './handlers/FigmaInputSetup';

/**
 * Interface for integration-specific setup handlers.
 * Only implement this if your integration needs setup/teardown logic.
 */
export interface InputSetupHandler {
    /**
     * Sets up the integration for the given automation input.
     * Called when an automation is created or updated.
     * @param integrationId The ID of the integration (e.g., user_slack_integrations.id)
     * @param automationInput The automation input with its config
     */
    setup(integrationId: string, automationInput: any): Promise<void>;

    /**
     * Tears down setup for the given integration and automation input.
     * Called when an automation is deleted.
     * @param integrationId The ID of the integration
     * @param automationInput The automation input with its config
     */
    tearDown(integrationId: string, automationInput: any): Promise<void>;
}

/**
 * Handles setup/teardown for automation inputs.
 * Only integrations that need setup logic (like joining Slack channels) register handlers.
 */
export class AutomationInputSetup {
    // Only register handlers that actually do something
    private static handlers = new Map<IntegrationType, InputSetupHandler>([
        [IntegrationType.SLACK, new SlackInputSetup()],
        [IntegrationType.FIGMA, new FigmaInputSetup()],
    ]);

    /**
     * Sets up all inputs in an automation.
     * Called after an automation is created or updated.
     */
    static async setupAutomationInputs(automationId: string): Promise<void> {
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
                            figma_config: true,
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
                        await handler.setup(input.integration_id, input);
                        console.log(
                            chalk.green(
                                `✅ Setup completed for ${input.integration_type} input (ID: ${input.id})`
                            )
                        );
                    } catch (error) {
                        console.error(
                            chalk.red(
                                `❌ Error setting up ${input.integration_type} input (ID: ${input.id}):`
                            ),
                            error
                        );
                        // Continue with other inputs even if one fails
                    }
                }
                // If no handler, skip silently - most integrations don't need setup
            }
        } catch (error) {
            console.error(chalk.red('❌ Error in setupAutomationInputs:'), error);
            // Don't throw - setup failures shouldn't break automation creation
        }
    }

    /**
     * Tears down setup for all inputs in an automation.
     * Called before an automation is deleted.
     */
    static async tearDownAutomationInputs(automationId: string): Promise<void> {
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
                            figma_config: true,
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
                        await handler.tearDown(input.integration_id, input);
                        console.log(
                            chalk.green(
                                `✅ Teardown completed for ${input.integration_type} input`
                            )
                        );
                    } catch (error) {
                        console.error(
                            chalk.red(
                                `❌ Error tearing down ${input.integration_type}:`
                            ),
                            error
                        );
                        // Continue with other inputs even if one fails
                    }
                }
                // If no handler, skip silently
            }
        } catch (error) {
            console.error(chalk.red('❌ Error in tearDownAutomationInputs:'), error);
            // Don't throw - teardown failures shouldn't break automation deletion
        }
    }
}

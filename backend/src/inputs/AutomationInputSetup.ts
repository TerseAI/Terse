import chalk from 'chalk';
import { IntegrationType } from '@prisma/client';
import { db } from '../prismaClient';
import { IntegrationRegistry, Integration } from '../integrations/abstract/Integration';

/**
 * Helper function to get IntegrationManager from IntegrationType
 */
function getIntegrationManager(integrationType: IntegrationType): Integration<any, any> | null {
    return IntegrationRegistry.find((manager: Integration<any, any>) => manager.getIntegrationType() === integrationType) || null;
}

/**
 * Handles setup/teardown for automation inputs.
 * Uses IntegrationRegistry to find integration managers that support setup/teardown.
 */
export class AutomationInputSetup {

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
                const integrationManager = getIntegrationManager(input.integration_type);
                if (integrationManager && integrationManager.setupIntegration) {
                    try {
                        await integrationManager.setupIntegration(input.integration_id, input);
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
                    }
                }
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
                const integrationManager = getIntegrationManager(input.integration_type);
                if (integrationManager && integrationManager.teardownIntegration) {
                    try {
                        await integrationManager.teardownIntegration(input.integration_id, input);
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
                // If no setup/teardown method, skip silently
            }
        } catch (error) {
            console.error(chalk.red('❌ Error in tearDownAutomationInputs:'), error);
            // Don't throw - teardown failures shouldn't break automation deletion
        }
    }
}

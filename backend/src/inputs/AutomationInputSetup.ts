import chalk from 'chalk';
import { InputConfigType, IntegrationType } from '@prisma/client';
import { db } from '../prismaClient';
import { AutomationInputManager } from './AutomationInputManager';
import { FigmaAutomationInputManager } from './FigmaAutomationInput';
import { AutomationInputWithConfigs, AutomationWithRelations } from 'src/types/prisma';

/**
 * Registry of automation input managers by integration type
 */
const automationInputManagers = new Map<InputConfigType, AutomationInputManager>([
    [InputConfigType.FIGMA, new FigmaAutomationInputManager()],
]);

/**
 * Helper function to get AutomationInputManager from IntegrationType
 */
function getAutomationInputManager(configType: InputConfigType): AutomationInputManager | null {
    return automationInputManagers.get(configType) || null;
}

/**
 * Handles setup/teardown for automation inputs.
 * Uses automation input managers registered by integration type.
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
                            notion_page_config: true,
                            confluence_config: true,
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
                const inputManager = getAutomationInputManager(input.config_type);
                if (inputManager) {
                    try {
                        await inputManager.setupAutomationInput(input.integration_id, input);
                        console.log(
                            chalk.green(
                                `✅ Setup completed for ${input.config_type} input (ID: ${input.id})`
                            )
                        );
                    } catch (error) {
                        console.error(
                            chalk.red(
                                `❌ Error setting up ${input.config_type} input (ID: ${input.id}):`
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
                            notion_page_config: true,
                            confluence_config: true,
                            figma_config: true,
                        },
                    },
                },
            });

            if (!automation) {
                return;
            }

            for (const input of automation.inputs) {
                const inputManager = getAutomationInputManager(input.config_type);
                if (inputManager) {
                    try {
                        await inputManager.teardownAutomationInput(input.integration_id, input);
                        console.log(
                            chalk.green(
                                `✅ Teardown completed for ${input.config_type} input`
                            )
                        );
                    } catch (error) {
                        console.error(
                            chalk.red(
                                `❌ Error tearing down ${input.config_type}:`
                            ),
                            error
                        );
                        // Continue with other inputs even if one fails
                    }
                }
                // If no automation input manager, skip silently
            }
        } catch (error) {
            console.error(chalk.red('❌ Error in tearDownAutomationInputs:'), error);
            // Don't throw - teardown failures shouldn't break automation deletion
        }
    }
}

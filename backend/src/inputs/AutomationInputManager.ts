import { AutomationInputWithConfigs } from "../types/prisma";

/**
 * Interface for integration managers that need to set up and tear down automation inputs.
 * For example, Figma needs to create webhooks when an automation input is created.
 */
export interface AutomationInputManager {
    /**
     * Sets up the automation input for the given integration.
     * Called when an automation is created or updated.
     * @param integrationId The ID of the integration (e.g., figma_integrations.id)
     * @param automationInput The automation input with its config
     */
    setupAutomationInput(integrationId: string, automationInput: AutomationInputWithConfigs): Promise<void>;

    /**
     * Tears down setup for the given automation input.
     * Called when an automation is deleted.
     * @param integrationId The ID of the integration
     * @param automationInput The automation input with its config
     */
    teardownAutomationInput(integrationId: string, automationInput: AutomationInputWithConfigs): Promise<void>;
}


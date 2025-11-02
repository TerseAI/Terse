import { BackendProvider } from "../services/backend";
import { Integration } from "../types/Integration";
import { getIntegrationName } from "./IntegrationUtils";

/**
 * Interface for automation input - only needs integration type for name generation
 */
interface AutomationInputLike {
    integration: Integration;
}

/**
 * Interface for automation output - only needs integration type for name generation
 */
interface AutomationOutputLike {
    integration: Integration;
}

/**
 * Generates a default name for an automation based on its inputs and output.
 * 
 * - If both inputs and output are present: generates a name like "Gmail -> Notion sync" 
 *   or "Gmail + Slack -> Notion sync" for multiple inputs
 * - If inputs or output are empty: generates "Automation #x" where x is the total count + 1
 */
export async function getDefaultAutomationName(
    inputs: AutomationInputLike[],
    output: AutomationOutputLike | undefined
): Promise<string> {
    // If both inputs and output are present, generate a descriptive name
    if (inputs.length > 0 && output !== undefined) {
        // Get all input integration names and join them with " + "
        const inputNames = inputs.map(input => getIntegrationName(input.integration)).join(' + ');
        const outputName = getIntegrationName(output.integration);
        return `${inputNames} -> ${outputName} sync`;
    }

    // If inputs or output are empty, generate "Automation #x"
    try {
        const response = await BackendProvider.getUserAutomations(1, 1);
        const totalCount = response.pagination.total;
        return `Automation #${totalCount + 1}`;
    } catch (error) {
        console.error('Error getting automation count:', error);
        // Fallback to a default name if the fetch fails
        return 'Automation #1';
    }
}

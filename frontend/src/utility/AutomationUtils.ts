import { IntegrationType } from "../shared/types"
import { getIntegrationName } from "./IntegrationUtils";

/**
 * Interface for automation input - only needs integration type for name generation
 */
interface AutomationInputLike {
    integration: IntegrationType;
}

/**
 * Interface for automation output - only needs integration type for name generation
 */
interface AutomationOutputLike {
    integration: IntegrationType;
}

/**
 * Generates a default name for an automation based on its inputs and output.
 * 
 * - If both inputs and output are present: generates a name like "Gmail -> Notion sync" 
 *   or "Gmail + Slack -> Notion sync" for multiple inputs
 * - If inputs or output are empty: generates "Automation #x" where x is the total count + 1
 * 
 * @param inputs - Array of automation inputs
 * @param output - Automation output (optional)
 * @param totalCount - Total count of existing automations (used for generating numbered names)
 */
export function getDefaultAutomationName(
    inputs: AutomationInputLike[],
    output: AutomationOutputLike | undefined,
    totalCount: number = 0
): string {
    // If both inputs and output are present, generate a descriptive name
    if (inputs.length > 0 && output !== undefined) {
        // Get all input integration names and join them with " + "
        const inputNames = inputs.map(input => getIntegrationName(input.integration)).join(' + ');
        const outputName = getIntegrationName(output.integration);
        return `${inputNames} -> ${outputName} sync`;
    }

    // If inputs or output are empty, generate "Automation #x"
    return `Automation #${totalCount + 1}`;
}

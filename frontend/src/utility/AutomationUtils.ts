import { AutomationInput, AutomationOutput, TransientAutomationInput, TransientAutomationOutput } from "@/shared/types";

export function getDefaultAutomationName(
    totalCount: number = 0
): string {
    // If inputs or output are empty, generate "Automation #x"
    return `Automation #${totalCount + 1}`;
}

/**
 * Converts AutomationInput to TransientAutomationInput
 * AutomationInput has a required config, TransientAutomationInput has optional config but requires configType
 */
export function toTransientAutomationInput(input: AutomationInput): TransientAutomationInput {
    return {
        id: input.id,
        config: input.config,
        configType: input.config.configType,
    };
}

/**
 * Converts AutomationOutput to TransientAutomationOutput
 * AutomationOutput has a required config, TransientAutomationOutput has optional config but requires configType
 */
export function toTransientAutomationOutput(output: AutomationOutput): TransientAutomationOutput {
    return {
        id: output.id,
        config: output.config,
        configType: output.config.configType,
    };
}

/**
 * Converts TransientAutomationInput to AutomationInput
 * Only converts if config is present (filters out incomplete inputs)
 */
export function toAutomationInput(input: TransientAutomationInput): AutomationInput | null {
    if (!input.config) {
        return null;
    }
    return {
        id: input.id,
        config: input.config,
    };
}

/**
 * Converts TransientAutomationOutput to AutomationOutput
 * Only converts if config is present
 */
export function toAutomationOutput(output: TransientAutomationOutput | undefined): AutomationOutput | undefined {
    if (!output || !output.config) {
        return undefined;
    }
    return {
        id: output.id,
        config: output.config,
    };
}

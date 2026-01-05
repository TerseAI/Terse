import { ChannelInput, ChannelOutput, TransientChannelInput, TransientChannelOutput, ChannelKnowledgeBase, TransientKnowledgeBase } from "@/shared/types";

export function getDefaultChannelName(
    totalCount: number = 0
): string {
    // If inputs or output are empty, generate "Automation #x"
    return `Automation #${totalCount + 1}`;
}

/**
 * Converts AutomationInput to TransientAutomationInput
 * AutomationInput has a required config, TransientAutomationInput has optional config but requires configType
 */
export function toTransientChannelInput(input: ChannelInput): TransientChannelInput {
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
export function toTransientChannelOutput(output: ChannelOutput): TransientChannelOutput {
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
export function toChannelInput(input: TransientChannelInput): ChannelInput | null {
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
export function toChannelOutput(output: TransientChannelOutput | undefined): ChannelOutput | undefined {
    if (!output || !output.config) {
        return undefined;
    }
    return {
        id: output.id,
        config: output.config,
    };
}

/**
 * Converts ChannelKnowledgeBase to TransientKnowledgeBase
 */
export function toTransientKnowledgeBase(kb: ChannelKnowledgeBase): TransientKnowledgeBase {
    return {
        id: kb.id,
        config: kb.config,
        configType: kb.config.configType,
    };
}

/**
 * Converts TransientKnowledgeBase to ChannelKnowledgeBase
 * Only converts if config is present (filters out incomplete knowledge bases)
 */
export function toChannelKnowledgeBase(kb: TransientKnowledgeBase): ChannelKnowledgeBase | null {
    if (!kb.config) {
        return null;
    }
    return {
        id: kb.id,
        config: kb.config,
    };
}

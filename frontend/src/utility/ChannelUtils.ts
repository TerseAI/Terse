import { AgentInput, AgentOutput, TransientAgentInput, TransientAgentOutput, AgentKnowledgeBase, TransientKnowledgeBase } from "@/shared/types";

export function getDefaultChannelName(
    totalCount: number = 0
): string {
    // If inputs or output are empty, generate "Automation #x"
    return `Automation #${totalCount + 1}`;
}

/**
 * Converts AgentInput to TransientAgentInput
 * AgentInput has a required config, TransientAgentInput has optional config but requires configType
 */
export function toTransientChannelInput(input: AgentInput): TransientAgentInput {
    return {
        id: input.id,
        config: input.config,
        configType: input.config.configType,
    };
}

/**
 * Converts AgentOutput to TransientAgentOutput
 * AgentOutput has a required config, TransientAgentOutput has optional config but requires configType
 */
export function toTransientChannelOutput(output: AgentOutput): TransientAgentOutput {
    return {
        id: output.id,
        config: output.config,
        configType: output.config.configType,
    };
}

/**
 * Converts TransientAgentInput to AgentInput
 * Only converts if config is present (filters out incomplete inputs)
 */
export function toChannelInput(input: TransientAgentInput): AgentInput | null {
    if (!input.config) {
        return null;
    }
    return {
        id: input.id,
        config: input.config,
    };
}

/**
 * Converts TransientAgentOutput to AgentOutput
 * Only converts if config is present
 */
export function toChannelOutput(output: TransientAgentOutput | undefined): AgentOutput | undefined {
    if (!output || !output.config) {
        return undefined;
    }
    return {
        id: output.id,
        config: output.config,
    };
}

/**
 * Converts AgentKnowledgeBase to TransientKnowledgeBase
 */
export function toTransientKnowledgeBase(kb: AgentKnowledgeBase): TransientKnowledgeBase {
    return {
        id: kb.id,
        config: kb.config,
        configType: kb.config.configType,
    };
}

/**
 * Converts TransientKnowledgeBase to AgentKnowledgeBase
 * Only converts if config is present (filters out incomplete knowledge bases)
 */
export function toChannelKnowledgeBase(kb: TransientKnowledgeBase): AgentKnowledgeBase | null {
    if (!kb.config) {
        return null;
    }
    return {
        id: kb.id,
        config: kb.config,
    };
}

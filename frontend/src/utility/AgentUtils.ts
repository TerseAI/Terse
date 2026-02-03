import { AgentKnowledgeBase, AgentOutput, AgentTrigger, TransientAgentOutput, TransientAgentTrigger, TransientKnowledgeBase } from "@/shared/types"

export function getDefaultAgentName(totalCount: number = 0): string {
    // Generate "Automation #x"
    return `Automation #${totalCount + 1}`
}

/**
 * Converts AutomationInput to TransientAutomationInput
 * AutomationInput has a required config, TransientAutomationInput has optional config but requires configType
 */
export function toTransientAgentTrigger(input: AgentTrigger): TransientAgentTrigger {
    return {
        id: input.id,
        config: input.config,
        configType: input.config.configType
    }
}

/**
 * Converts AutomationOutput to TransientAutomationOutput
 * AutomationOutput has a required config, TransientAutomationOutput has optional config but requires configType
 */
export function toTransientAgentOutput(output: AgentOutput): TransientAgentOutput {
    return {
        id: output.id,
        config: output.config,
        configType: output.config.configType
    }
}

/**
 * Converts TransientAutomationInput to AutomationInput
 * Only converts if config is present (filters out incomplete inputs)
 */
export function toAgentTrigger(input: TransientAgentTrigger): AgentTrigger | null {
    if (!input.config) {
        return null
    }
    return {
        id: input.id,
        config: input.config
    }
}

/**
 * Converts TransientAutomationOutput to AutomationOutput
 * Only converts if config is present
 */
export function toAgentOutput(output: TransientAgentOutput | undefined): AgentOutput | undefined {
    if (!output || !output.config) {
        return undefined
    }
    return {
        id: output.id,
        config: output.config
    }
}

/**
 * Converts AgentKnowledgeBase to TransientKnowledgeBase
 */
export function toTransientKnowledgeBase(kb: AgentKnowledgeBase): TransientKnowledgeBase {
    return {
        id: kb.id,
        config: kb.config,
        configType: kb.config.configType
    }
}

/**
 * Converts TransientKnowledgeBase to AgentKnowledgeBase
 * Only converts if config is present (filters out incomplete knowledge bases)
 */
export function toAgentKnowledgeBase(kb: TransientKnowledgeBase): AgentKnowledgeBase | null {
    if (!kb.config) {
        return null
    }
    return {
        id: kb.id,
        config: kb.config
    }
}

import { AgentTrigger, AgentOutput, AgentTriggerWithConfigs, AgentOutputWithConfigs, AgentKnowledgeBaseWithConfigs, AgentWithRelations } from '../../types/prisma';
import { convertPrismaConfigToConfigInstance, convertPrismaOutputConfigToConfigInstance, convertPrismaKnowledgeBaseConfigToConfigInstance } from '../../utility/typeConverters';
import logger from '../../logger';

export function formatAgentForSystemPrompt(agent: AgentWithRelations): string {
    const sections: string[] = [];

    // Header with name and status
    sections.push(`Agent: "${agent.name}"`);
    sections.push(`Status: ${agent.is_active ? 'Active' : 'Inactive'}`);
    sections.push(`Requires Approval: ${agent.require_approval ? 'Yes' : 'No'}`);

    // Prompt section
    if (agent.prompt?.content) {
        sections.push('');
        sections.push('Prompt:');
        sections.push(indent(agent.prompt.content));
    }

    // Triggers section
    if (agent.inputs && agent.inputs.length > 0) {
        sections.push('');
        sections.push('Triggers:');
        sections.push(indent(formatAgentTriggersForAgent(agent.inputs)));
    }

    // Outputs section
    if (agent.outputs && agent.outputs.length > 0) {
        sections.push('');
        sections.push('Outputs:');
        sections.push(indent(formatAgentOutputsForAgent(agent.outputs)));
    }

    // Knowledge Bases section
    if (agent.knowledge_bases && agent.knowledge_bases.length > 0) {
        sections.push('');
        sections.push('Knowledge Bases:');
        sections.push(indent(formatAgentKnowledgeBasesForAgent(agent.knowledge_bases as AgentKnowledgeBaseWithConfigs[])));
    }

    return sections.join('\n');
}

export function formatAgentTriggerForAgent(input: AgentTrigger | AgentTriggerWithConfigs): string {
    try {
        const configInstance = convertPrismaConfigToConfigInstance(input as AgentTriggerWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        logger.warn('Failed to convert channel input to ConfigInstance', { error, configType: input.config_type, inputId: input.id });
        return `Type: ${input.config_type}`;
    }
}

export function formatAgentOutputForAgent(output: AgentOutput | AgentOutputWithConfigs): string {
    try {
        const configInstance = convertPrismaOutputConfigToConfigInstance(output as AgentOutputWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        logger.warn('Failed to convert channel output to ConfigInstance', { error, configType: output.config_type, outputId: output.id });
        return `Type: ${output.config_type}`;
    }
}

export function formatAgentKnowledgeBaseForAgent(kb: AgentKnowledgeBaseWithConfigs): string {
    try {
        const configInstance = convertPrismaKnowledgeBaseConfigToConfigInstance(kb);
        return configInstance.formatForAgent();
    } catch (error) {
        logger.warn('Failed to convert knowledge base to ConfigInstance', { error, configType: kb.config_type, kbId: kb.id });
        return `Type: ${kb.config_type}`;
    }
}

export function formatAgentTriggersForAgent(inputs: (AgentTrigger | AgentTriggerWithConfigs)[]): string {
    if (inputs.length === 0) {
        return 'No triggers configured';
    }

    if (inputs.length === 1) {
        return formatAgentTriggerForAgent(inputs[0]);
    }

    return inputs
        .map((input, index) => {
            const formatted = formatAgentTriggerForAgent(input);
            return `Trigger ${index + 1}:\n${indent(formatted)}`;
        })
        .join('\n\n');
}

export function formatAgentOutputsForAgent(outputs: (AgentOutput | AgentOutputWithConfigs)[]): string {
    if (outputs.length === 0) {
        return 'No outputs configured';
    }

    if (outputs.length === 1) {
        return formatAgentOutputForAgent(outputs[0]);
    }

    return outputs
        .map((output, index) => {
            const formatted = formatAgentOutputForAgent(output);
            return `Output ${index + 1}:\n${indent(formatted)}`;
        })
        .join('\n\n');
}

export function formatAgentKnowledgeBasesForAgent(knowledgeBases: AgentKnowledgeBaseWithConfigs[]): string {
    if (knowledgeBases.length === 0) {
        return 'No knowledge bases configured';
    }

    if (knowledgeBases.length === 1) {
        return formatAgentKnowledgeBaseForAgent(knowledgeBases[0]);
    }

    return knowledgeBases
        .map((kb, index) => {
            const formatted = formatAgentKnowledgeBaseForAgent(kb);
            return `Knowledge Base ${index + 1}:\n${indent(formatted)}`;
        })
        .join('\n\n');
}

function indent(text: string, spaces: number = 2): string {
    const prefix = ' '.repeat(spaces);
    return text.split('\n').map(line => `${prefix}${line}`).join('\n');
}
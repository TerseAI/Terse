import { AgentTrigger, AgentOutput, AgentTriggerWithConfigs, AgentOutputWithConfigs, AgentKnowledgeBaseWithConfigs } from '../../types/prisma';
import { convertPrismaConfigToConfigInstance, convertPrismaOutputConfigToConfigInstance, convertPrismaKnowledgeBaseConfigToConfigInstance } from '../../utility/typeConverters';
import logger from '../../logger';

export function formatAgentTriggerForAgent(input: AgentTrigger | AgentTriggerWithConfigs): string {
    try {
        const configInstance = convertPrismaConfigToConfigInstance(input as AgentTriggerWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        // If conversion fails, return basic type info
        logger.warn('Failed to convert channel input to ConfigInstance', { error, configType: input.config_type, inputId: input.id });
        return `Type: ${input.config_type}`;
    }
}

export function formatAgentTriggersForAgent(inputs: (AgentTrigger | AgentTriggerWithConfigs)[]): string {
    if (inputs.length === 0) {
        return 'No inputs configured';
    }

    if (inputs.length === 1) {
        return formatAgentTriggerForAgent(inputs[0]);
    }

    return inputs
        .map((input, index) => {
            const formatted = formatAgentTriggerForAgent(input);
            return `Input ${index + 1}:\n${formatted.split('\n').map(line => `  ${line}`).join('\n')}`;
        })
        .join('\n\n');
}
import { ChannelInput, ChannelOutput, ChannelInputWithConfigs, ChannelOutputWithConfigs, ChannelKnowledgeBaseWithConfigs } from '../../types/prisma';
import { convertPrismaConfigToConfigInstance, convertPrismaOutputConfigToConfigInstance, convertPrismaKnowledgeBaseConfigToConfigInstance } from '../../utility/typeConverters';
import logger from '../../logger';

export function formatChannelInputForAgent(input: ChannelInput | ChannelInputWithConfigs): string {
    try {
        const configInstance = convertPrismaConfigToConfigInstance(input as ChannelInputWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        // If conversion fails, return basic type info
        logger.warn('Failed to convert channel input to ConfigInstance', { error, configType: input.config_type, inputId: input.id });
        return `Type: ${input.config_type}`;
    }
}

export function formatChannelInputsForAgent(inputs: (ChannelInput | ChannelInputWithConfigs)[]): string {
    if (inputs.length === 0) {
        return 'No inputs configured';
    }

    if (inputs.length === 1) {
        return formatChannelInputForAgent(inputs[0]);
    }

    return inputs
        .map((input, index) => {
            const formatted = formatChannelInputForAgent(input);
            return `Input ${index + 1}:\n${formatted.split('\n').map(line => `  ${line}`).join('\n')}`;
        })
        .join('\n\n');
}
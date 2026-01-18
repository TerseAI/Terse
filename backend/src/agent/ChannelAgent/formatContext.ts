import { ChannelInput, ChannelOutput, ChannelInputWithConfigs, ChannelOutputWithConfigs } from '../../types/prisma';
import { convertPrismaConfigToConfigInstance, convertPrismaOutputConfigToConfigInstance } from '../../utility/typeConverters';
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

export function formatChannelOutputForAgent(output: ChannelOutput | ChannelOutputWithConfigs): string {
    try {
        const configInstance = convertPrismaOutputConfigToConfigInstance(output as ChannelOutputWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        logger.warn('Failed to convert channel output to ConfigInstance', { error, configType: output.config_type, outputId: output.id });
        return `Type: ${output.config_type}`;
    }
}

export function formatChannelOutputsForAgent(outputs: (ChannelOutput | ChannelOutputWithConfigs)[]): string {
    if (outputs.length === 0) {
        return 'No outputs configured';
    }

    if (outputs.length === 1) {
        return formatChannelOutputForAgent(outputs[0]);
    }

    return outputs
        .map((output, index) => {
            const formatted = formatChannelOutputForAgent(output);
            return `Output ${index + 1}:\n${formatted.split('\n').map(line => `  ${line}`).join('\n')}`;
        })
        .join('\n\n');
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

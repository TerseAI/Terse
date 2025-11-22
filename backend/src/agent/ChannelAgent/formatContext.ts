import { ChannelInput, ChannelOutput, ChannelInputWithConfigs, ChannelOutputWithConfigs } from '../../types/prisma';
import { convertPrismaConfigToConfigInstance, convertPrismaOutputConfigToConfigInstance } from '../../utility/typeConverters';

export function formatChannelInputForAgent(input: ChannelInput | ChannelInputWithConfigs): string {
    try {
        const configInstance = convertPrismaConfigToConfigInstance(input as ChannelInputWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        // If conversion fails, return basic type info
        console.warn('Failed to convert channel input to ConfigInstance:', error);
        return `Type: ${input.config_type}`;
    }
}

export function formatChannelOutputForAgent(output: ChannelOutput | ChannelOutputWithConfigs): string {
    try {
        const configInstance = convertPrismaOutputConfigToConfigInstance(output as ChannelOutputWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        console.warn('Failed to convert channel output to ConfigInstance:', error);
        return `Type: ${output.config_type}`;
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

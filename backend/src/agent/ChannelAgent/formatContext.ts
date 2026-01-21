import { AgentInput, AgentOutput, AgentInputWithConfigs, AgentOutputWithConfigs } from '../../types/prisma';
import { convertPrismaConfigToConfigInstance, convertPrismaOutputConfigToConfigInstance } from '../../utility/typeConverters';
import logger from '../../logger';

export function formatAgentInputForAgent(input: AgentInput | AgentInputWithConfigs): string {
    try {
        const configInstance = convertPrismaConfigToConfigInstance(input as AgentInputWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        // If conversion fails, return basic type info
        logger.warn('Failed to convert agent input to ConfigInstance', { error, configType: input.config_type, inputId: input.id });
        return `Type: ${input.config_type}`;
    }
}

export function formatAgentOutputForAgent(output: AgentOutput | AgentOutputWithConfigs): string {
    try {
        const configInstance = convertPrismaOutputConfigToConfigInstance(output as AgentOutputWithConfigs);
        return configInstance.formatForAgent();
    } catch (error) {
        logger.warn('Failed to convert agent output to ConfigInstance', { error, configType: output.config_type, outputId: output.id });
        return `Type: ${output.config_type}`;
    }
}

export function formatAgentInputsForAgent(inputs: (AgentInput | AgentInputWithConfigs)[]): string {
    if (inputs.length === 0) {
        return 'No triggers configured';
    }

    if (inputs.length === 1) {
        return formatAgentInputForAgent(inputs[0]);
    }

    return inputs
        .map((input, index) => {
            const formatted = formatAgentInputForAgent(input);
            return `Trigger ${index + 1}:\n${formatted.split('\n').map(line => `  ${line}`).join('\n')}`;
        })
        .join('\n\n');
}

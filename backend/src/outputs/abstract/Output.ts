import { Tool, webSearchTool } from "@openai/agents";
import { ChannelOutputWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { OutputConfigType } from "@prisma/client";
import { ConfigInstance } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";

export interface ToolboxEntry {
    tool: Tool;
    isReadOnly: boolean;
    integration: IntegrationType;
}

export abstract class Output<TConfig extends ConfigInstance> {
    integration: OutputConfigType;
    readonly toolbox: readonly ToolboxEntry[];

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration;
        this.toolbox = [...defaultToolbox, ...toolbox] 
    }

    abstract validateConfig(output: TConfig, userId: string): Promise<void>;

    abstract addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: TConfig): Promise<void>;

    abstract getSystemInstructions(configs: Array<{ integrationId: string, channelOutput: ChannelOutputWithConfigs }>): string;

    /**
     * Formats this output configuration for the "Available Configurations" section of the system prompt.
     * Each output type knows how to format its own details.
     * @param config Configuration object with integrationId and channelOutput
     * @returns Formatted string like "Integration ID: X, Type: Y, Details: Z"
     */
    abstract formatForAvailableConfigurationsSection(config: { integrationId: string, channelOutput: ChannelOutputWithConfigs }): string;
}

export const defaultToolbox: readonly ToolboxEntry[] = [
    {
        tool: webSearchTool({
            searchContextSize: 'medium',
        }),
        isReadOnly: true,
        integration: IntegrationType.TERSE
    }
]
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
    configs: ChannelOutputWithConfigs[] = [];

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration;
        this.toolbox = [...defaultToolbox, ...toolbox] 
    }

    abstract validateConfig(output: TConfig, userId: string): Promise<void>;

    abstract addOutputToChannel(tx: PrismaTransaction, channelOutputId: string, output: TConfig): Promise<void>;

    /**
     * Returns system instructions for this output.
     * Uses the configs property that should be set when the instance is created.
     */
    getSystemInstructions(): string {
        return this.getSystemInstructionsForConfigs(this.configs);
    }

    /**
     * Protected method that subclasses implement to generate system instructions.
     * This maintains the existing signature for subclasses.
     */
    protected abstract getSystemInstructionsForConfigs(configs: ChannelOutputWithConfigs[]): string;
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
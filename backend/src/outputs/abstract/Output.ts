import { Tool } from "@openai/agents";
import { AgentOutputWithConfigs, PrismaTransaction, User } from "../../types/prisma";
import { OutputConfigType } from "@prisma/client";
import { ConfigInstance } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";

export interface ToolboxEntry {
    tool: Tool;
    isReadOnly: boolean;
    integration: IntegrationType;
    displayName: string;
}

export abstract class Output<TConfig extends ConfigInstance> {
    integration: OutputConfigType;
    readonly toolbox: readonly ToolboxEntry[];
    configs: AgentOutputWithConfigs[] = [];

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration;
        // Don't include defaultToolbox anymore - TerseSkills handles common tools
        this.toolbox = toolbox;
    }

    abstract validateConfig(output: TConfig, userId: string): Promise<void>;

    abstract addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: TConfig): Promise<void>;

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
    protected abstract getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string;
}

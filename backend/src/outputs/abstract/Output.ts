import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { CapabilityDescription } from "../../capabilityHelpers"
import { ConfigInstance } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"

export interface ToolboxEntry {
    tool: Tool
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
}

export abstract class Output<TConfig extends ConfigInstance> {
    integration: OutputConfigType
    readonly toolbox: readonly ToolboxEntry[]
    configs: AgentOutputWithConfigs[] = []

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration
        this.toolbox = toolbox
    }

    abstract getCapabilityDescription(): CapabilityDescription

    abstract validateConfig(output: TConfig, userId: string): Promise<void>

    abstract addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: TConfig): Promise<void>

    /**
     * Returns system instructions. When useDummyConfig is true, uses a minimal dummy config
     * instead of this.configs—useful for capability lookup where no real configs exist.
     */
    getSystemInstructions(useDummyConfig = false): string {
        const configs = useDummyConfig ? [this.getDummyConfigForCapability()] : this.configs
        return this.getSystemInstructionsForConfigs(configs)
    }

    /** Minimal dummy config for generating system instructions when no real configs exist. */
    protected abstract getDummyConfigForCapability(): AgentOutputWithConfigs

    /**
     * Protected method that subclasses implement to generate system instructions.
     */
    protected abstract getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string
}

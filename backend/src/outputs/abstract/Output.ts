import { ToolInputParameters, ToolOptions } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { SessionWithTracking } from "../../agent/AgentRunner/BaseAgentRunner"
import { ConfigInstance } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { PrismaTransaction } from "../../types/prisma"
import { Session } from "../../types/session"

export interface ToolboxEntry {
    tool: ToolOptions<ToolInputParameters, SessionWithTracking<Session>>
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
    /** If true, this tool can be selected for approval even though it is read-only. TODO: extend approval tool support for all tools  */
    supportsApproval?: boolean
}

export interface RuntimeSystemInstructionsContext {
    userId: string
}

export abstract class Output<TConfig extends ConfigInstance> {
    integration: OutputConfigType
    readonly toolbox: readonly ToolboxEntry[]
    configs: TConfig[] = []

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration
        this.toolbox = toolbox
    }

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
    protected abstract getDummyConfigForCapability(): TConfig

    /**
     * Protected method that subclasses implement to generate system instructions.
     */
    protected abstract getSystemInstructionsForConfigs(configs: TConfig[]): string

    /**
     * Returns runtime system instructions, with access to run-scoped context (e.g. userId).
     */
    async getRuntimeSystemInstructions(_context: RuntimeSystemInstructionsContext): Promise<string> {
        return this.getSystemInstructions()
    }
}

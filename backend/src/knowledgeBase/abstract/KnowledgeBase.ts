// MARK: - Output Integrations
import { KnowledgeBaseConfigType } from "@prisma/client"

import { CapabilityDescription } from "../../capabilityHelpers"
import { ToolboxEntry } from "../../outputs/abstract/Output"
import { ConfigInstance } from "../../shared/Configs"
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction } from "../../types/prisma"

export abstract class KnowledgeBase<KBConfig extends ConfigInstance> {
    integration: KnowledgeBaseConfigType
    readonly toolbox: readonly ToolboxEntry[]
    configs: AgentKnowledgeBaseWithConfigs[] = []

    constructor(integration: KnowledgeBaseConfigType, toolbox: readonly ToolboxEntry[]) {
        this.integration = integration
        this.toolbox = [...toolbox]
    }

    abstract getCapabilityDescription(): CapabilityDescription

    abstract validateConfig(knowledgeBase: KBConfig, userId: string): Promise<void>

    abstract addKnowledgeBaseToAgent(tx: PrismaTransaction, agentKnowledgeBaseId: string, knowledgeBase: KBConfig): Promise<void>

    /**
     * Returns system instructions. When useDummyConfig is true, uses a minimal dummy config
     * instead of this.configs—useful for capability lookup where no real configs exist.
     */
    getSystemInstructions(useDummyConfig = false): string {
        const configs = useDummyConfig ? [this.getDummyConfigForCapability()] : this.configs
        return this.getSystemInstructionsForConfigs(configs)
    }

    /** Minimal dummy config for generating system instructions when no real configs exist. */
    protected abstract getDummyConfigForCapability(): AgentKnowledgeBaseWithConfigs

    protected abstract getSystemInstructionsForConfigs(configs: AgentKnowledgeBaseWithConfigs[]): string
}

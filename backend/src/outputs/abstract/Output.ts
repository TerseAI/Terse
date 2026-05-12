import { OutputConfigType } from "@prisma/client"
import { ConfigData, ToolName } from "terse-types"
import { IntegrationType } from "terse-types"

import { SessionWithTracking } from "../../agent/AgentRunner/BaseAgentRunner"
import { Session } from "../../express"
import { TypedToolOptions } from "../../tools/toolUtils"
import { PrismaTransaction } from "../../types/prisma"

import { ToolACLValidationResult, ToolACLValidatorParams } from "./acl"

export abstract class Output<TConfig extends ConfigData> {
    integration: OutputConfigType
    readonly toolbox: readonly ToolboxEntry<ToolName, TConfig>[]
    configs: TConfig[] = []

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry<ToolName, TConfig>[]) {
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

export interface ToolboxEntry<TName extends ToolName, TConfig extends ConfigData> {
    tool: TypedToolOptions<TName, SessionWithTracking<Session>>
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
    supportsApproval?: boolean
    validateACL(params: ToolACLValidatorParams<TName, TConfig>): Promise<ToolACLValidationResult> | ToolACLValidationResult
}

export const defineToolEntry =
    <TConfig extends ConfigData>() =>
    <TName extends ToolName>(entry: ToolboxEntry<TName, TConfig>): ToolboxEntry<ToolName, TConfig> =>
        entry as unknown as ToolboxEntry<ToolName, TConfig>

export interface RuntimeSystemInstructionsContext {
    userId: string
}

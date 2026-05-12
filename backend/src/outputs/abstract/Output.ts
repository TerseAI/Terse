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
    readonly toolbox: readonly ToolboxEntry<TConfig>[]
    configs: TConfig[] = []

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntryInput<TConfig>[]) {
        this.integration = integration
        // Widen each per-tool narrow entry to a more general type for consumers.
        this.toolbox = toolbox as readonly ToolboxEntry<TConfig>[]
    }

    abstract validateConfig(output: TConfig, userId: string): Promise<void>

    abstract addOutputToAgent(tx: PrismaTransaction, agentOutputId: string, output: TConfig): Promise<void>

    /**
     * Returns system instructions. When useDummyConfig is true, uses a minimal dummy config
     * instead of this.configs—useful for capability lookup where no real configs exist.
     */
    getSystemInstructions(): string {
        const configs = this.configs
        return this.getSystemInstructionsForConfigs(configs)
    }

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

export type ToolboxEntryInput<TConfig extends ConfigData> = {
    [TName in ToolName]: {
        tool: TypedToolOptions<TName, SessionWithTracking<Session>>
        isReadOnly: boolean
        integration: IntegrationType
        displayName: string
        supportsApproval?: boolean
        validateACL: (params: ToolACLValidatorParams<TName, TConfig>) => Promise<ToolACLValidationResult> | ToolACLValidationResult
    }
}[ToolName]

export interface ToolboxEntry<TConfig extends ConfigData> {
    tool: TypedToolOptions<ToolName, SessionWithTracking<Session>>
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
    supportsApproval?: boolean
    validateACL(params: ToolACLValidatorParams<ToolName, TConfig>): Promise<ToolACLValidationResult> | ToolACLValidationResult
}

export interface RuntimeSystemInstructionsContext {
    userId: string
}

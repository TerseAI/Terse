import { RunContext } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"
import type { ACLRule, ConfigData, ToolInputByName, ToolName } from "terse-types"
import { IntegrationType } from "terse-types"

import { SessionWithTracking } from "../../agent/AgentRunner/BaseAgentRunner"
import { Session } from "../../express"
import { TypedToolOptions } from "../../tools/toolUtils"
import { PrismaTransaction } from "../../types/prisma"

export abstract class Output<TConfig extends ConfigData> {
    integration: OutputConfigType
    readonly toolbox: readonly ToolboxEntry<any>[]
    configs: TConfig[] = []

    constructor(integration: OutputConfigType, toolbox: readonly ToolboxEntry<any>[]) {
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

export type ToolACLValidationResult = { ok: true } | { ok: false; message: string }

export type ToolACLValidator<TArgs = unknown> = (params: {
    args: TArgs
    aclRules: ACLRule[]
    /** Present when the guardrail runs inside an agent turn; optional so validators that only need args + rules stay simple. */
    runContext?: RunContext<SessionWithTracking<Session>>
}) => Promise<ToolACLValidationResult> | ToolACLValidationResult

export type ToolboxEntry<TName extends ToolName = ToolName> = {
    tool: TypedToolOptions<TName, SessionWithTracking<Session>>
    isReadOnly: boolean
    integration: IntegrationType
    displayName: string
    /** If true, this tool can be selected for approval even though it is read-only. TODO: extend approval tool support for all tools  */
    supportsApproval?: boolean
    validateACL?: ToolACLValidator<ToolInputByName[TName]>
}

export function defineToolboxEntry<TName extends ToolName>(entry: ToolboxEntry<TName>): ToolboxEntry<TName> {
    return entry
}

export function outputIsReadOnly(configs: ConfigData[]): boolean {
    return configs.length > 0 && configs.every(config => config.readOnly === true)
}

export interface RuntimeSystemInstructionsContext {
    userId: string
}

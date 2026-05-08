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

export function denyToolACL(message: string): ToolACLValidationResult {
    return { ok: false, message }
}

export type ToolACLValidator<TArgs = unknown> = (params: {
    args: TArgs
    aclRules: ACLRule[]
    /** Flattened configs for all outputs on this run (write validators use `readOnly` + `integrationId`). */
    configs: ConfigData[]
    /** Present when the guardrail runs inside an agent turn; optional so validators that only need args + rules stay simple. */
    runContext?: RunContext<SessionWithTracking<Session>>
}) => Promise<ToolACLValidationResult> | ToolACLValidationResult

export function formatConfigAccess(config: ConfigData): string {
    return config.readOnly === true ? "read-only" : "read-write"
}

/** True when this `integrationId` has at least one non-read-only config on the run. */
export function configIsWritableForIntegration(params: { configs: ConfigData[]; integrationId: string }): boolean {
    return params.configs.some(config => config.integrationId === params.integrationId && config.readOnly !== true)
}

/** True when every config for this `integrationId` is explicitly read-only (and at least one config matches). */
export function configIsReadOnlyForIntegration(params: { configs: ConfigData[]; integrationId: string }): boolean {
    const matching = params.configs.filter(config => config.integrationId === params.integrationId)
    return matching.length > 0 && matching.every(config => config.readOnly === true)
}

/** Some configs read-only and some read-write within the same output/run instructions context. */
export function outputHasMixedReadOnlyAndWritable(configs: ConfigData[]): boolean {
    return configs.some(config => config.readOnly === true) && configs.some(config => config.readOnly !== true)
}

export function mixedReadWriteToolInstructionParagraph(): string {
    return "\nWrite tools may only be used with integration IDs marked read-write.\nDo not use write tools with integration IDs marked read-only."
}

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

/** True when every config on this output instance is read-only (and there is at least one config). */
export function allConfigsReadOnly(configs: ConfigData[]): boolean {
    return configs.length > 0 && configs.every(config => config.readOnly === true)
}

export interface RuntimeSystemInstructionsContext {
    userId: string
}

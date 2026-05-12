import { RunContext } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"
import { ConfigData, ToolInputByName, ToolName } from "terse-types"
import { IntegrationType } from "terse-types"

import { SessionWithTracking } from "../../agent/AgentRunner/BaseAgentRunner"
import { Session } from "../../express"
import { TypedToolOptions } from "../../tools/toolUtils"
import { PrismaTransaction } from "../../types/prisma"

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

export interface ToolACLValidatorParams<TName extends ToolName, TConfig extends ConfigData> {
    args: ToolInputByName[TName]
    configs: TConfig[]
    runContext?: RunContext<SessionWithTracking<Session>>
}

export interface RuntimeSystemInstructionsContext {
    userId: string
}

export type ToolACLValidator<TName extends ToolName, TConfig extends ConfigData> = (params: ToolACLValidatorParams<TName, TConfig>) => Promise<ToolACLValidationResult> | ToolACLValidationResult

export function denyToolACL(message: string): ToolACLValidationResult {
    return { ok: false, message }
}

export type ToolACLValidationResult = { ok: true } | { ok: false; message: string }

export const defineToolEntry =
    <TConfig extends ConfigData>() =>
    <TName extends ToolName>(entry: ToolboxEntry<TName, TConfig>): ToolboxEntry<ToolName, TConfig> =>
        entry as unknown as ToolboxEntry<ToolName, TConfig>

export const doesIntegrationIdExist = (integrationId: string, configs: ConfigData[]): boolean => {
    const config = configs.find(config => config.integrationId === integrationId)
    return !!config
}

export const verifyIntegrationIdExists = (integrationId: string, configs: ConfigData[]): ToolACLValidationResult => {
    return doesIntegrationIdExist(integrationId, configs) ? { ok: true } : denyToolACL(`Integration ID ${integrationId} not found`)
}

export const findConfigByIntegrationId = <TConfig extends ConfigData>(integrationId: string, configs: TConfig[]): TConfig | undefined => configs.find(c => c.integrationId === integrationId)

export const requireInAllowedList = (value: string | null | undefined, allowed: readonly string[], label: string): ToolACLValidationResult =>
    value && allowed.includes(value) ? { ok: true } : denyToolACL(`${label} ${value ?? "(missing)"} is not in the allowed list: ${allowed.join(", ") || "(none)"}`)

export const requireAllInAllowedList = (values: readonly string[] | null | undefined, allowed: readonly string[], label: string): ToolACLValidationResult => {
    const offenders = (values ?? []).filter(v => !allowed.includes(v))
    return offenders.length === 0 ? { ok: true } : denyToolACL(`${label} not in allowed list: ${offenders.join(", ")}`)
}

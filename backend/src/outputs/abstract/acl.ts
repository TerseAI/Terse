import { RunContext, ToolGuardrailFunctionOutputFactory, ToolInputGuardrailDefinition, defineToolInputGuardrail } from "@openai/agents-core"
import { ConfigData, ToolInputByName, ToolName, toolsWithIntegrationId } from "terse-types"

import logger from "../../common/logger"
import { Session } from "../../express"
import { SessionWithTracking } from "../../modules/agents/AgentRunner/BaseAgentRunner"

import { Output, ToolboxEntry } from "./Output"

export function createToolACLGuardrail<TConfig extends ConfigData>(entry: ToolboxEntry<TConfig>, output: Output<TConfig>): ToolInputGuardrailDefinition<SessionWithTracking<Session>> {
    const validate = entry.validateACL
    const toolName = entry.tool.name

    return defineToolInputGuardrail<SessionWithTracking<Session>>({
        name: `acl:${toolName}`,
        run: async ({ context, toolCall }) => {
            try {
                const args = JSON.parse(toolCall.arguments)
                const idRejection = checkIntegrationIdGuardrail(args, output.configs, toolName)
                if (idRejection) return idRejection
                const result = await validate({
                    args,
                    configs: output.configs,
                    runContext: context
                })
                if (result.ok) {
                    return ToolGuardrailFunctionOutputFactory.allow()
                }
                logger.info(`[ACL] Soft-denying tool ${toolName}`, { message: result.message })
                return rejectAsFailure(result.message || "")
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                logger.error(`[ACL] Validator for ${toolName} threw`, { error: message })
                return rejectAsFailure(`Tool ${toolName} blocked: ACL check failed (${message})`)
            }
        }
    })
}

function checkIntegrationIdGuardrail(args: unknown, configs: ConfigData[], toolName: string) {
    if (!isArgsWithIntegrationId(args)) return null

    const idCheck = verifyIntegrationIdExists(args.integrationId, configs)
    if (idCheck.ok) return null

    logger.info(`[ACL] Unknown integrationId for ${toolName}`, { message: idCheck.message })

    return rejectAsFailure(idCheck.message || "")
}

function isArgsWithIntegrationId(args: unknown): args is { integrationId: string } {
    return typeof args === "object" && args !== null && "integrationId" in args
}

// Wraps the rejection in a structured-failure payload so downstream parsing (extractStructuredFailure) marks the tool call as failed in the UI.
function rejectAsFailure(message: string) {
    return ToolGuardrailFunctionOutputFactory.rejectContent(JSON.stringify({ success: false, text: message }))
}

export function requireValueInAnyConfig<T extends ConfigData>(args: {
    integrationId: string
    configs: T[]
    label: string
    pickAllowed: (config: T) => readonly string[] | null | undefined
    value: string | null | undefined
}): ToolACLValidationResult {
    const matchingConfigs = findConfigsByIntegrationId(args.integrationId, args.configs)
    const allowed = Array.from(new Set(matchingConfigs.flatMap(c => args.pickAllowed(c) ?? [])))
    return requireInAllowedList(args.value, allowed, `${args.label} for integration "${args.integrationId}"`)
}

export function requireAllValuesInAnyConfig<T extends ConfigData>(args: {
    integrationId: string
    configs: T[]
    label: string
    pickAllowed: (config: T) => readonly string[] | null | undefined
    values: readonly string[] | null | undefined
}): ToolACLValidationResult {
    const matchingConfigs = findConfigsByIntegrationId(args.integrationId, args.configs)
    const allowed = Array.from(new Set(matchingConfigs.flatMap(c => args.pickAllowed(c) ?? [])))
    return requireAllInAllowedList(args.values, allowed, `${args.label} for integration "${args.integrationId}"`)
}

export function findConfigsByIntegrationId<TConfig extends ConfigData>(integrationId: string, configs: TConfig[]): TConfig[] {
    return configs.filter(c => c.integrationId === integrationId)
}

export function requireInAllowedList(value: string | null | undefined, allowed: readonly string[], label: string): ToolACLValidationResult {
    if (value && allowed.includes(value)) {
        return { ok: true }
    }
    return denyToolACL(`${label} ${value ?? "(missing)"} is not in the allowed list: ${allowed.join(", ")}`)
}

export function requireAllInAllowedList(values: readonly string[] | null | undefined, allowed: readonly string[], label: string): ToolACLValidationResult {
    const offenders = (values ?? []).filter(v => !allowed.includes(v))
    if (offenders.length === 0) {
        return { ok: true }
    }
    return denyToolACL(`${label} not in allowed list (${offenders.join(", ")}). Allowed: ${allowed.join(", ")}.`)
}

export function denyToolACL(message: string): ToolACLValidationResult {
    return { ok: false, message }
}

// Normalizes an allowed-domain entry to a bare lowercase host (strips scheme, path, port, and a leading "www.").
export function normalizeDomain(domain: string): string {
    let host = domain.trim().toLowerCase()
    host = host.replace(/^[a-z]+:\/\//, "")
    host = host.split("/")[0].split("@").pop() ?? host
    host = host.split(":")[0]
    return host.replace(/^www\./, "")
}

// True when `host` equals an allowed domain or is a subdomain of one.
export function isHostAllowed(host: string, allowedDomains: readonly string[]): boolean {
    const normalizedHost = normalizeDomain(host)
    return allowedDomains.some(domain => {
        const allowed = normalizeDomain(domain)
        return allowed.length > 0 && (normalizedHost === allowed || normalizedHost.endsWith(`.${allowed}`))
    })
}

// Resolves the hostname of a URL string, returning null when it cannot be parsed.
function hostFromUrl(value: string): string | null {
    try {
        return new URL(value).hostname
    } catch {
        return null
    }
}

// Denies when any value is not a URL whose host falls within the allowed domains. Unparseable URLs are treated as offenders.
export function requireHostsInAllowedDomains(values: readonly string[], allowedDomains: readonly string[], label: string): ToolACLValidationResult {
    const offenders = values.filter(value => {
        const host = hostFromUrl(value)
        return host === null || !isHostAllowed(host, allowedDomains)
    })
    if (offenders.length === 0) {
        return { ok: true }
    }
    return denyToolACL(`${label} not in allowed domains (${offenders.join(", ")}). Allowed: ${allowedDomains.join(", ")}.`)
}

export function verifyIntegrationIdExists(integrationId: string, configs: ConfigData[]): ToolACLValidationResult {
    if (doesIntegrationIdExist(integrationId, configs)) return { ok: true }
    const known = listIntegrationIds(configs).join(", ") || "(none)"
    return denyToolACL(`Integration ID "${integrationId}" not found. Configured integrations: ${known}.`)
}

function doesIntegrationIdExist(integrationId: string, configs: ConfigData[]): boolean {
    const config = configs.find(config => config.integrationId === integrationId)
    return !!config
}

function listIntegrationIds(configs: readonly ConfigData[]): string[] {
    return Array.from(new Set(configs.map(c => c.integrationId)))
}

export const unrestricted: ToolACLValidator<any, any> = () => ({ ok: true })

export type ToolACLValidator<TName extends ToolName, TConfig extends ConfigData> = (params: ToolACLValidatorParams<TName, TConfig>) => Promise<ToolACLValidationResult> | ToolACLValidationResult

export type ToolACLValidationResult = {
    ok: boolean
    message?: string
}

export interface ToolACLValidatorParams<TName extends ToolName, TConfig extends ConfigData> {
    args: ToolInputByName[TName]
    configs: TConfig[]
    runContext: RunContext<SessionWithTracking<Session>>
}

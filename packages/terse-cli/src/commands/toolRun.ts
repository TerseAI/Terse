import { ApiRoutes, integrationTypeEnum, isValidToolName, toolsWithIntegrationId } from "terse-types"
import { z } from "zod"

import { ApiError, fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { CliError, isCliError } from "../cliError.js"
import { readRawStdin } from "../cliHelpers.js"
import { fetchIntegrationConnections } from "../integrationApi.js"
import { readProjectConfig } from "../projectConfig.js"
import { toCamelCase } from "../providers/typescript/modules/moduleHelpers.js"
import { type ToolDetails, fetchToolDetails } from "../toolCatalog.js"

export async function integrateToolRun(opts: IntegrateToolRunOpts): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const params = await readToolParams(opts.params)
    const catalog = await fetchToolDetails(apiKey)
    const tool = resolveTool(opts.toolName, catalog)
    assertAdHocRunnable(tool)
    const finalParams = await withIntegrationId(params, tool, opts.integrationId, apiKey)
    const result = await executeTool(tool.name, finalParams, apiKey)
    process.stdout.write(JSON.stringify(result ?? null, null, 2) + "\n")
}

async function readToolParams(raw: string | undefined): Promise<Record<string, unknown>> {
    if (raw !== undefined && raw !== "-") return parseParamsJson(raw, "--params")

    if (raw === "-" || !process.stdin.isTTY) {
        const fromStdin = await readRawStdin()
        if (fromStdin) return parseParamsJson(fromStdin, "stdin")
        if (raw === "-") {
            throw new CliError("missing_params", "Expected JSON params on stdin (--params -), but stdin was empty.")
        }
    }

    return {}
}

function parseParamsJson(raw: string, source: string): Record<string, unknown> {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch (err) {
        throw new CliError("invalid_params", `Could not parse JSON params from ${source}.`, {
            detail: err instanceof Error ? err.message : String(err)
        })
    }

    const result = z.record(z.string(), z.unknown()).safeParse(parsed)
    if (!result.success || Array.isArray(parsed)) {
        throw new CliError("invalid_params", `Params from ${source} must be a JSON object.`, {
            detail: 'Example: --params \'{"objectSlug":"deals","request":{"action":"query"}}\''
        })
    }
    return result.data
}

function resolveTool(input: string, catalog: ToolDetails[]): ToolDetails {
    const exact = catalog.find(tool => tool.name === input)
    if (exact) return exact

    const dotIndex = input.indexOf(".")
    if (dotIndex > 0) {
        const integration = input.slice(0, dotIndex)
        const method = input.slice(dotIndex + 1)
        const match = catalog.find(tool => tool.integration === integration && toCamelCase(tool.displayName) === method)
        if (match) return match

        const available = catalog.filter(tool => tool.integration === integration)
        if (available.length > 0) {
            throw new CliError("unknown_tool", `Unknown tool '${method}' for integration '${integration}'.`, {
                detail: `Available: ${available.map(tool => `${integration}.${toCamelCase(tool.displayName)} [${tool.name}]${tool.isReadOnly ? "" : " (write)"}`).join(", ")}`
            })
        }
    }

    throw new CliError("unknown_tool", `Unknown tool '${input}'.`, {
        detail: "Pass a wire name (attio_records) or dotted form (attio.records). Use `terse integrate tool <integration>` to list tools."
    })
}

function assertAdHocRunnable(tool: ToolDetails): void {
    if (tool.isReadOnly && !tool.supportsApproval) return
    const reason = tool.isReadOnly ? "requires approval" : "is a write tool"
    throw new CliError("tool_not_runnable", `Tool '${tool.name}' ${reason} and cannot be run ad hoc.`, {
        detail: "Only read-only tools can be invoked with `terse integrate tool run`. Call this tool from a job instead."
    })
}

async function withIntegrationId(params: Record<string, unknown>, tool: ToolDetails, flagIntegrationId: string | undefined, apiKey: string): Promise<Record<string, unknown>> {
    if (flagIntegrationId) return { ...params, integrationId: flagIntegrationId }
    if (params.integrationId !== undefined) return params
    if (!toolRequiresIntegrationId(tool.name)) return params

    const pinned = pinnedConnectionFor(tool.integration)
    if (pinned) return { ...params, integrationId: pinned }

    return { ...params, integrationId: await resolveSingleIntegrationId(tool.integration, apiKey) }
}

function toolRequiresIntegrationId(toolName: string): boolean {
    return isValidToolName(toolName) && toolsWithIntegrationId.has(toolName)
}

function pinnedConnectionFor(integration: string): string | undefined {
    const parsed = integrationTypeEnum.safeParse(integration)
    if (!parsed.success) return undefined
    return readProjectConfig()?.connections?.[parsed.data]
}

async function resolveSingleIntegrationId(integration: string, apiKey: string): Promise<string> {
    const connections = await fetchIntegrationConnections(apiKey, integration)
    if (connections.length === 0) {
        throw new CliError("integration_not_connected", `Integration '${integration}' is not connected.`, {
            detail: `Run \`terse integrate connect ${integration}\` first.`,
            actionRequired: true
        })
    }
    if (connections.length > 1) {
        const listing = connections.map(connection => (connection.name === connection.id ? connection.id : `${connection.id} (${connection.name})`)).join(", ")
        throw new CliError("integration_ambiguous", `Integration '${integration}' has ${connections.length} connections.`, {
            detail: `List them with \`terse integrate connections ${integration} --json\`, then pass --integration <id> or pin one for this project with \`terse integrate use ${integration} <id>\`. Connections: ${listing}`
        })
    }
    return connections[0].id
}

async function executeTool(toolName: string, params: Record<string, unknown>, apiKey: string): Promise<unknown> {
    try {
        const response = await fetchWithAuth<{ success: boolean; result?: unknown }>(ApiRoutes.SDK.TOOL_EXECUTE, apiKey, { toolName, params }, "POST")
        return response.result
    } catch (err) {
        throw toToolExecutionError(err, toolName)
    }
}

function toToolExecutionError(err: unknown, toolName: string): CliError {
    if (isCliError(err)) return err
    if (err instanceof ApiError && typeof err.body.error === "string") {
        return new CliError("tool_execution_failed", `Tool '${toolName}' failed: ${err.body.error}`)
    }
    return new CliError("tool_execution_failed", `Tool '${toolName}' failed: ${err instanceof Error ? err.message : String(err)}`)
}

export type IntegrateToolRunOpts = {
    toolName: string
    params?: string
    integrationId?: string
}

import { intro, log, outro } from "@clack/prompts"
import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import type {
    AttioIntegration,
    DatadogIntegration,
    GithubIntegration,
    GmailIntegration,
    HeyReachIntegration,
    LaunchDarklyIntegration,
    LinearIntegration,
    NotionIntegration,
    PosthogIntegration,
    SlackIntegration,
    SnowflakeIntegration,
    WorkOSIntegration
} from "terse-types"
import { ApiRoutes, IntegrationType, type ToolDefinition, buildRoute, isValidToolName, posthogProjectEventsResponseSchema, toolDefinitionsResponseSchema } from "terse-types"

import { ApiError, fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { assertProjectRoot } from "../assertProjectRoot.js"
import { CliError, ErrorCode } from "../cliError.js"
import { createSpinner, formatSummaryList } from "../cliUi.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import {
    type AttioAttributeData,
    type AttioInstanceData,
    type CodegenInput,
    type DatadogInstanceData,
    type GitHubInstanceData,
    type HeyReachInstanceData,
    type LaunchDarklyInstanceData,
    type LinearInstanceData,
    type NotionInstanceData,
    type PosthogInstanceData,
    type SlackInstanceData
} from "../providers/codegenTypes.js"
import { resolveProvider } from "../providers/resolveProvider.js"

// Platform-native integrations have no connected instance, so they never appear in the org's active
// integrations. Their tools are always generated; availability is still gated by skills at runtime.
const PLATFORM_NATIVE_INTEGRATIONS = new Set<string>([IntegrationType.TERSE])

export async function generate(provider: LanguageProvider = resolveProvider(), opts?: { apiKey?: string }): Promise<void> {
    intro("terse generate")
    assertProjectRoot(provider, provider.detectionMarkers)

    const totalStart = performance.now()
    const s = createSpinner()

    s.start("Checking authentication")

    const apiKey =
        opts?.apiKey?.trim() ||
        readApiKeyOrBail({
            title: "\n  Not authenticated.\n",
            detail: "  Run `terse auth login` to authenticate, or set TERSE_API_KEY in your environment.\n"
        })

    s.message("Fetching integrations")

    let activeTypes: IntegrationType[]
    try {
        activeTypes = await fetchWithAuth<IntegrationType[]>(ApiRoutes.INTEGRATIONS.ACTIVE, apiKey)
    } catch (error: any) {
        s.stop("Failed to fetch integrations")
        const message = String(error?.message || "")
        const isAuthError =
            (error instanceof ApiError && (error.status === 401 || error.status === 403)) ||
            message.includes("401") ||
            message.includes("403") ||
            message.toLowerCase().includes("authentication failed") ||
            message.toLowerCase().includes("unauthorized") ||
            message.toLowerCase().includes("forbidden")

        if (isAuthError) {
            throw new CliError("not_authenticated", "Authentication failed: your TERSE_API_KEY was rejected.", {
                detail: "Run `terse auth login` to refresh your credentials and try again.",
                actionRequired: true,
                exitCode: ErrorCode.BAD_ARGUMENTS
            })
        }

        throw new CliError("fetch_integrations_failed", message || "Failed to fetch integrations.")
    }

    s.message("Fetching tool definitions")

    let toolDefs: ToolDefinition[] = []
    try {
        const raw = await fetchWithAuth<unknown>(ApiRoutes.SDK.TOOL_DEFINITIONS, apiKey)
        const resp = toolDefinitionsResponseSchema.parse(raw)
        const activeSet = new Set(activeTypes as string[])
        toolDefs = resp.tools.filter(t => activeSet.has(t.integration) || PLATFORM_NATIVE_INTEGRATIONS.has(t.integration))
        const skippedToolNames = [...new Set(toolDefs.filter(t => !isValidToolName(t.name)).map(t => t.name))].sort()
        toolDefs = toolDefs.filter(t => isValidToolName(t.name))
        if (skippedToolNames.length > 0) {
            log.warn(`Skipped ${skippedToolNames.length} tool(s) absent from terse-types ToolDefinitions: ${skippedToolNames.join(", ")}`)
        }
    } catch {
        log.warn("Skipped tool definitions fetch; proceeding without typed tool wrappers")
    }

    s.message("Fetching integration details")

    const input: CodegenInput = {
        github: [],
        slack: [],
        gmail: [],
        linear: [],
        notion: [],
        posthog: [],
        datadog: [],
        launchdarkly: [],
        workos: [],
        attio: [],
        snowflake: [],
        heyreach: [],
        tools: toolDefs
    }

    const has = (t: IntegrationType) => activeTypes.includes(t)
    const promises: Promise<void>[] = []

    if (has(IntegrationType.GITHUB)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<GithubIntegration[]>(ApiRoutes.GITHUB.INTEGRATIONS, apiKey)
                input.github = await Promise.all(
                    instances.map(async (inst): Promise<GitHubInstanceData> => {
                        const data = await fetchWithAuth<{ repositories: Array<{ id: number; name: string; owner: string }> }>(
                            `${ApiRoutes.GITHUB.GET_REPOSITORIES_FOR_INTEGRATION}?installation_id=${encodeURIComponent(inst.installation_id)}`,
                            apiKey
                        ).catch(() => ({ repositories: [] }))
                        return { integration: inst, repositories: data.repositories || [] }
                    })
                )
            })
        )
    }

    if (has(IntegrationType.GMAIL)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<GmailIntegration[]>(ApiRoutes.GMAIL.INTEGRATIONS, apiKey)
                input.gmail = instances.map(inst => ({ id: inst.id, displayName: inst.email || inst.id }))
            })
        )
    }

    if (has(IntegrationType.SLACK)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<SlackIntegration[]>(ApiRoutes.SLACK.INTEGRATIONS, apiKey)
                input.slack = await Promise.all(
                    instances.map(async (inst): Promise<SlackInstanceData> => {
                        const [channelsResp, usersResp] = await Promise.all([
                            fetchWithAuth<{ channels: Array<{ id: string; name: string }> }>(`${ApiRoutes.SLACK.CHANNELS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({
                                channels: []
                            })),
                            fetchWithAuth<{ users: Array<{ id: string; name: string }> }>(`${ApiRoutes.SLACK.USERS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({ users: [] }))
                        ])
                        return {
                            id: inst.id,
                            displayName: inst.teamName || inst.id,
                            channels: channelsResp.channels || [],
                            users: usersResp.users || []
                        }
                    })
                )
            })
        )
    }

    if (has(IntegrationType.LINEAR)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<LinearIntegration[]>(ApiRoutes.LINEAR.INTEGRATIONS, apiKey)
                input.linear = await Promise.all(
                    instances.map(async (inst): Promise<LinearInstanceData> => {
                        const teams = await fetchWithAuth<Array<{ id: string; name: string; key: string }>>(`${ApiRoutes.LINEAR.TEAMS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(
                            () => [] as Array<{ id: string; name: string; key: string }>
                        )
                        const projects = await fetchWithAuth<Array<{ id: string; name: string; description?: string; teamId: string }>>(
                            `${ApiRoutes.LINEAR.PROJECTS}?integrationId=${encodeURIComponent(inst.id)}`,
                            apiKey
                        ).catch(() => [] as Array<{ id: string; name: string; description?: string; teamId: string }>)
                        return {
                            id: inst.id,
                            displayName: inst.workspaceName || inst.id,
                            teams: Array.isArray(teams) ? teams : [],
                            projects: Array.isArray(projects) ? projects : []
                        }
                    })
                )
            })
        )
    }

    if (has(IntegrationType.NOTION)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<NotionIntegration[]>(ApiRoutes.NOTION.INTEGRATIONS, apiKey)
                input.notion = await Promise.all(
                    instances.map(async (inst): Promise<NotionInstanceData> => {
                        const resp = await fetchWithAuth<{ resources: Array<{ id: string; title: string; type: string }> }>(
                            `${ApiRoutes.NOTION.RESOURCES}?integrationId=${encodeURIComponent(inst.id)}`,
                            apiKey
                        ).catch(() => ({ resources: [] }))
                        const resources = resp.resources || []
                        return {
                            id: inst.id,
                            displayName: inst.workspaceName || inst.id,
                            databases: resources.filter(r => r.type === "database"),
                            pages: resources.filter(r => r.type === "page")
                        }
                    })
                )
            })
        )
    }

    if (has(IntegrationType.POSTHOG)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<PosthogIntegration[]>(ApiRoutes.POSTHOG.INTEGRATIONS, apiKey)
                input.posthog = await Promise.all(
                    instances.map(async (inst): Promise<PosthogInstanceData> => {
                        const resp = await fetchWithAuth<{ projects: Array<{ id: string; name: string }> }>(`${ApiRoutes.POSTHOG.PROJECTS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(
                            () => ({ projects: [] })
                        )
                        const projects = await Promise.all(
                            (resp.projects || []).map(async project => {
                                const events = await fetchPosthogProjectEventNames(inst.id, project.id, apiKey)
                                return { ...project, events }
                            })
                        )
                        return { id: inst.id, displayName: inst.orgName || inst.email || inst.id, projects }
                    })
                )
            })
        )
    }

    if (has(IntegrationType.DATADOG)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<DatadogIntegration[]>(ApiRoutes.DATADOG.INTEGRATIONS, apiKey)
                input.datadog = await Promise.all(
                    instances.map(async (inst): Promise<DatadogInstanceData> => {
                        const resp = await fetchWithAuth<{ indexes: Array<{ name: string }> }>(`${ApiRoutes.DATADOG.INDEXES}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(() => ({
                            indexes: []
                        }))
                        return { id: inst.id, displayName: inst.region || inst.id, indexes: resp.indexes || [] }
                    })
                )
            })
        )
    }

    if (has(IntegrationType.LAUNCHDARKLY)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<LaunchDarklyIntegration[]>(ApiRoutes.LAUNCHDARKLY.INTEGRATIONS, apiKey)
                input.launchdarkly = await Promise.all(
                    instances.map(async (inst): Promise<LaunchDarklyInstanceData> => {
                        const resp = await fetchWithAuth<{ projects: Array<{ key: string; name: string }> }>(
                            buildRoute(ApiRoutes.LAUNCHDARKLY.PROJECTS_BY_INTEGRATION_ID, { integrationId: inst.id }),
                            apiKey
                        ).catch(() => ({ projects: [] }))
                        return { id: inst.id, displayName: inst.tokenName || inst.email || inst.id, projects: resp.projects || [] }
                    })
                )
            })
        )
    }

    if (has(IntegrationType.WORKOS)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<WorkOSIntegration[]>(ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS, apiKey)
                input.workos = instances.map(inst => ({ id: inst.id, displayName: inst.environment || inst.id }))
            })
        )
    }

    if (has(IntegrationType.ATTIO)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<AttioIntegration[]>(ApiRoutes.ATTIO.INTEGRATIONS, apiKey)
                input.attio = await Promise.all(
                    instances.map(async (inst): Promise<AttioInstanceData> => {
                        const objects = await fetchWithAuth<
                            Array<{
                                id: { workspace_id: string; object_id: string }
                                api_slug: string
                                singular_noun: string
                                plural_noun?: string
                                attributes?: AttioAttributeData[]
                            }>
                        >(buildRoute(ApiRoutes.ATTIO.OBJECTS, { integrationId: inst.id }), apiKey).catch(
                            () =>
                                [] as Array<{
                                    id: { workspace_id: string; object_id: string }
                                    api_slug: string
                                    singular_noun: string
                                    plural_noun?: string
                                    attributes?: AttioAttributeData[]
                                }>
                        )
                        return { id: inst.id, displayName: inst.workspaceName || inst.id, objects: Array.isArray(objects) ? objects : [] }
                    })
                )
            })
        )
    }

    if (has(IntegrationType.SNOWFLAKE)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<SnowflakeIntegration[]>(ApiRoutes.SNOWFLAKE.INTEGRATIONS, apiKey)
                input.snowflake = instances.map(inst => ({ id: inst.id, name: inst.accountIdentifier }))
            })
        )
    }

    if (has(IntegrationType.HEY_REACH)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<HeyReachIntegration[]>(ApiRoutes.HEY_REACH.INTEGRATIONS, apiKey)
                input.heyreach = await Promise.all(
                    instances.map(async (inst): Promise<HeyReachInstanceData> => {
                        const resp = await fetchWithAuth<{ campaigns: Array<{ id: string; name: string }> }>(
                            `${ApiRoutes.HEY_REACH.CAMPAIGNS}?integrationId=${encodeURIComponent(inst.id)}`,
                            apiKey
                        ).catch(() => ({ campaigns: [] }))
                        return { id: inst.id, displayName: inst.id, campaigns: resp.campaigns || [] }
                    })
                )
            })
        )
    }

    await Promise.all(promises)

    const integrationCount =
        input.github.length +
        input.slack.length +
        input.gmail.length +
        input.linear.length +
        input.notion.length +
        input.posthog.length +
        input.datadog.length +
        input.launchdarkly.length +
        input.workos.length +
        input.attio.length +
        input.heyreach.length

    s.message("Generating code")

    const codegenStart = performance.now()
    const code = provider.renderGeneratedCode(input)
    const codegenMs = performance.now() - codegenStart

    s.message("Writing generated file")
    writeOutput(code, provider)
    s.stop(`Fetched ${integrationCount} integration(s)`)

    const totalMs = performance.now() - totalStart
    const integrationSummary = summarizeIntegrations(input)

    if (integrationSummary) {
        console.log(chalk.dim(`Integrations: ${integrationSummary}`))
    }
    if (input.tools.length > 0) {
        console.log(chalk.dim(`Generated types for ${input.tools.length} ${input.tools.length === 1 ? "tool" : "tools"}`))
    }
    console.log(chalk.dim(`Generated ${path.relative(process.cwd(), provider.resolveGeneratedCodePath(process.cwd()))}`))
    console.log(chalk.dim(`Codegen: ${codegenMs.toFixed(0)}ms | Total: ${totalMs.toFixed(0)}ms`))
}

async function safely(fn: () => Promise<void>): Promise<void> {
    try {
        await fn()
    } catch {
        /* skip failed integrations */
    }
}

async function fetchPosthogProjectEventNames(integrationId: string, projectId: string, apiKey: string): Promise<string[]> {
    try {
        const raw = await fetchWithAuth<unknown>(`${ApiRoutes.POSTHOG.EVENTS}?integrationId=${encodeURIComponent(integrationId)}&projectId=${encodeURIComponent(projectId)}`, apiKey)
        return posthogProjectEventsResponseSchema.parse(raw).events.map(event => event.name)
    } catch {
        log.warn(`Could not fetch PostHog event names for project ${projectId}; eventName stays untyped until the next successful terse generate`)
        return []
    }
}

function writeOutput(code: string, provider: LanguageProvider): void {
    const outputPath = provider.resolveGeneratedCodePath(process.cwd())
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }
    fs.writeFileSync(outputPath, code)
}

function summarizeIntegrations(input: CodegenInput): string {
    const parts: string[] = []

    if (input.github.length > 0) parts.push(labelWithCount("GitHub", input.github.length))
    if (input.gmail.length > 0) parts.push(labelWithCount("Gmail", input.gmail.length))
    if (input.slack.length > 0) parts.push(labelWithCount("Slack", input.slack.length))
    if (input.linear.length > 0) parts.push(labelWithCount("Linear", input.linear.length))
    if (input.notion.length > 0) parts.push(labelWithCount("Notion", input.notion.length))
    if (input.posthog.length > 0) parts.push(labelWithCount("PostHog", input.posthog.length))
    if (input.datadog.length > 0) parts.push(labelWithCount("Datadog", input.datadog.length))
    if (input.launchdarkly.length > 0) parts.push(labelWithCount("LaunchDarkly", input.launchdarkly.length))
    if (input.workos.length > 0) parts.push(labelWithCount("WorkOS", input.workos.length))
    if (input.attio.length > 0) parts.push(labelWithCount("Attio", input.attio.length))
    if (input.snowflake.length > 0) parts.push(labelWithCount("Snowflake", input.snowflake.length))
    if (input.heyreach.length > 0) parts.push(labelWithCount("HeyReach", input.heyreach.length))

    return formatSummaryList(parts, 10)
}

function labelWithCount(label: string, count: number): string {
    return count === 1 ? label : `${label} (${count})`
}

// Types

type GenerateOptions = {
    showLifecycle?: boolean
}

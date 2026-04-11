import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"
import type {
    AttioIntegration,
    DatadogIntegration,
    GithubIntegration,
    GmailIntegration,
    LaunchDarklyIntegration,
    LinearIntegration,
    NotionIntegration,
    PosthogIntegration,
    SlackIntegration,
    SnowflakeIntegration,
    WorkOSIntegration
} from "terse-types"
import { IntegrationType, isValidToolName } from "terse-types"
import { ApiRoutes, buildRoute } from "terse-types"

import { fetchWithAuth, readApiKeyOrBail } from "./api.js"
import { assertProjectRoot } from "./assertProjectRoot.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"
import {
    type AttioAttributeData,
    type AttioInstanceData,
    type CodegenInput,
    type DatadogInstanceData,
    type GitHubInstanceData,
    type LaunchDarklyInstanceData,
    type LinearInstanceData,
    type NotionInstanceData,
    type PosthogInstanceData,
    type SlackInstanceData,
    type ToolDefinition
} from "./providers/codegenTypes.js"
import { resolveProvider } from "./providers/resolveProvider.js"

// ── Main ──────────────────────────────────────────────────────────────

export async function generate(provider: LanguageProvider = resolveProvider()): Promise<void> {
    assertProjectRoot(provider)

    const totalStart = performance.now()

    // 1. Read API key
    const apiKey = readApiKeyOrBail({
        title: "\n  Missing TERSE_API_KEY in .env\n",
        detail: "  Create a project with `terse init` or add TERSE_API_KEY to your .env file.\n"
    })

    // 2. Fetch active integrations
    const spinner = ora("Fetching integrations...").start()

    let activeTypes: IntegrationType[]
    try {
        activeTypes = await fetchWithAuth<IntegrationType[]>(ApiRoutes.INTEGRATIONS.ACTIVE, apiKey)
    } catch (error: any) {
        spinner.fail("Failed to fetch integrations")
        const message = String(error?.message || "")
        const isAuthError =
            message.includes("401") ||
            message.includes("403") ||
            message.toLowerCase().includes("authentication failed") ||
            message.toLowerCase().includes("unauthorized") ||
            message.toLowerCase().includes("forbidden")

        if (isAuthError) {
            console.error(chalk.red("\n  Authentication failed: your TERSE_API_KEY was rejected.\n") + chalk.dim("  Update TERSE_API_KEY in .env and try again.\n"))
        } else {
            console.error(chalk.red(`\n  ${message}\n`))
        }
        process.exit(1)
    }

    // 3. Fetch tool definitions
    spinner.text = "Fetching tool definitions..."

    let toolDefs: ToolDefinition[] = []
    try {
        const resp = await fetchWithAuth<{ tools: ToolDefinition[] }>(ApiRoutes.SDK.TOOL_DEFINITIONS, apiKey)
        // Filter to only tools whose integration matches an active integration type
        const activeSet = new Set(activeTypes as string[])
        toolDefs = resp.tools.filter(t => activeSet.has(t.integration))
        const skippedToolNames = [...new Set(toolDefs.filter(t => !isValidToolName(t.name)).map(t => t.name))].sort()
        toolDefs = toolDefs.filter(t => isValidToolName(t.name))
        if (skippedToolNames.length > 0) {
            console.warn(chalk.yellow(`\n  Skipped ${skippedToolNames.length} tool(s) absent from terse-types ToolDefinitions: ${skippedToolNames.join(", ")}\n`))
        }
    } catch {
        // Non-fatal: proceed without tool definitions
    }

    // 4. Fetch all integration instances + resources in parallel
    spinner.text = "Fetching integration details..."

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
        tools: toolDefs
    }

    const has = (t: IntegrationType) => activeTypes.includes(t)
    const promises: Promise<void>[] = []

    // ── GitHub (special: also fetches repositories per instance) ──
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

    // ── Gmail (no resources) ──
    if (has(IntegrationType.GMAIL)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<GmailIntegration[]>(ApiRoutes.GMAIL.INTEGRATIONS, apiKey)
                input.gmail = instances.map(inst => ({ id: inst.id, displayName: inst.email || inst.id }))
            })
        )
    }

    // ── Slack (fetches channels per instance) ──
    if (has(IntegrationType.SLACK)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<SlackIntegration[]>(ApiRoutes.SLACK.INTEGRATIONS, apiKey)
                input.slack = await Promise.all(
                    instances.map(async (inst): Promise<SlackInstanceData> => {
                        const resp = await fetchWithAuth<{ channels: Array<{ id: string; name: string }> }>(`${ApiRoutes.SLACK.CHANNELS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(
                            () => ({ channels: [] })
                        )
                        return { id: inst.id, displayName: inst.teamName || inst.id, channels: resp.channels || [] }
                    })
                )
            })
        )
    }

    // ── Linear (fetches teams per instance) ──
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

    // ── Notion (fetches databases + pages per instance) ──
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

    // ── PostHog (fetches projects per instance) ──
    if (has(IntegrationType.POSTHOG)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<PosthogIntegration[]>(ApiRoutes.POSTHOG.INTEGRATIONS, apiKey)
                input.posthog = await Promise.all(
                    instances.map(async (inst): Promise<PosthogInstanceData> => {
                        const resp = await fetchWithAuth<{ projects: Array<{ id: string; name: string }> }>(`${ApiRoutes.POSTHOG.PROJECTS}?integrationId=${encodeURIComponent(inst.id)}`, apiKey).catch(
                            () => ({ projects: [] })
                        )
                        return { id: inst.id, displayName: inst.orgName || inst.email || inst.id, projects: resp.projects || [] }
                    })
                )
            })
        )
    }

    // ── Datadog (fetches indexes per instance) ──
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

    // ── LaunchDarkly (fetches projects per instance — URL path param) ──
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

    // ── WorkOS (no resources) ──
    if (has(IntegrationType.WORKOS)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<WorkOSIntegration[]>(ApiRoutes.WORKOS_INTEGRATION.INTEGRATIONS, apiKey)
                input.workos = instances.map(inst => ({ id: inst.id, displayName: inst.environment || inst.id }))
            })
        )
    }

    // ── Attio (fetches objects per instance — URL path param) ──
    if (has(IntegrationType.ATTIO)) {
        promises.push(
            safely(async () => {
                const instances = await fetchWithAuth<AttioIntegration[]>(ApiRoutes.ATTIO.INTEGRATIONS, apiKey)
                input.attio = await Promise.all(
                    instances.map(async (inst): Promise<AttioInstanceData> => {
                        const objects = await fetchWithAuth<
                            Array<{
                                api_slug: string
                                singular_noun: string
                                plural_noun?: string
                                attributes?: AttioAttributeData[]
                            }>
                        >(buildRoute(ApiRoutes.ATTIO.OBJECTS, { integrationId: inst.id }), apiKey).catch(
                            () =>
                                [] as Array<{
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
        input.attio.length

    spinner.succeed(`Fetched ${integrationCount} integration(s)`)

    // 5. Generate code
    const codegenStart = performance.now()
    const code = provider.renderGeneratedCode(input)
    const codegenMs = performance.now() - codegenStart

    // 6. Write output
    writeOutput(code, provider)

    // 7. Summary
    const totalMs = performance.now() - totalStart

    console.log("")
    printSummary(input)
    if (input.tools.length > 0) {
        console.log(`  ${chalk.green("+")} ${input.tools.length} typed tool ${input.tools.length === 1 ? "wrapper" : "wrappers"}`)
    }
    console.log(`  ${chalk.green("+")} Schedule trigger`)
    console.log(`  ${chalk.green("+")} Terse skills (web search)`)
    console.log("")
    console.log(`  ${chalk.green.bold("Generated")} ${provider.generatedCodePath}`)
    console.log(`  ${chalk.dim(`Codegen: ${codegenMs.toFixed(0)}ms | Total: ${totalMs.toFixed(0)}ms`)}`)
    console.log("")
}

// ── Helpers ───────────────────────────────────────────────────────────

async function safely(fn: () => Promise<void>): Promise<void> {
    try {
        await fn()
    } catch {
        /* skip failed integrations */
    }
}

function writeOutput(code: string, provider: LanguageProvider): void {
    const outputPath = path.resolve(process.cwd(), provider.generatedCodePath)
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }
    fs.writeFileSync(outputPath, code)
}

function printSummary(input: CodegenInput): void {
    const g = chalk.green("+")

    for (const inst of input.github) {
        const name = inst.integration.account_name || inst.integration.id
        const n = inst.repositories.length
        console.log(`  ${g} GitHub (${name}) — ${n} ${n === 1 ? "repository" : "repositories"}`)
    }
    for (const inst of input.gmail) {
        console.log(`  ${g} Gmail (${inst.displayName})`)
    }
    for (const inst of input.slack) {
        const n = inst.channels.length
        console.log(`  ${g} Slack (${inst.displayName}) — ${n} ${n === 1 ? "channel" : "channels"}`)
    }
    for (const inst of input.linear) {
        const n = inst.teams.length
        console.log(`  ${g} Linear (${inst.displayName}) — ${n} ${n === 1 ? "team" : "teams"}`)
    }
    for (const inst of input.notion) {
        const d = inst.databases.length
        const p = inst.pages.length
        console.log(`  ${g} Notion (${inst.displayName}) — ${d} ${d === 1 ? "database" : "databases"}, ${p} ${p === 1 ? "page" : "pages"}`)
    }
    for (const inst of input.posthog) {
        const n = inst.projects.length
        console.log(`  ${g} PostHog (${inst.displayName}) — ${n} ${n === 1 ? "project" : "projects"}`)
    }
    for (const inst of input.datadog) {
        const n = inst.indexes.length
        console.log(`  ${g} Datadog (${inst.displayName}) — ${n} ${n === 1 ? "index" : "indexes"}`)
    }
    for (const inst of input.launchdarkly) {
        const n = inst.projects.length
        console.log(`  ${g} LaunchDarkly (${inst.displayName}) — ${n} ${n === 1 ? "project" : "projects"}`)
    }
    for (const inst of input.workos) {
        console.log(`  ${g} WorkOS (${inst.displayName})`)
    }
    for (const inst of input.attio) {
        const n = inst.objects.length
        console.log(`  ${g} Attio (${inst.displayName}) — ${n} ${n === 1 ? "object" : "objects"}`)
    }
}

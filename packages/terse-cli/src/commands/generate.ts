import { intro, log, outro } from "@clack/prompts"
import chalk from "chalk"
import fs from "node:fs"
import path from "node:path"
import { ApiRoutes, IntegrationType, type ToolDefinition, isValidToolName, toolDefinitionsResponseSchema } from "terse-types"

import { ApiError, fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { assertProjectRoot } from "../assertProjectRoot.js"
import { CliError, ErrorCode } from "../cliError.js"
import { createSpinner, formatSummaryList } from "../cliUi.js"
import { fetchIntegrations } from "../integrationApi.js"
import { readProjectConfig } from "../projectConfig.js"
import type { GeneratedFile, LanguageProvider } from "../providers/LanguageProvider.js"
import type { CodegenResult } from "../providers/codegenTypes.js"
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

    s.message("Fetching integration catalog")

    let availableIntegrations: string[] = []
    try {
        const catalog = await fetchIntegrations(apiKey)
        availableIntegrations = [...new Set(catalog.map(entry => entry.integrationType))].sort()
    } catch {
        log.warn("Skipped integration catalog fetch; proceeding without the available-integrations list")
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

    const codegenTimer = { start: performance.now() }
    let result: CodegenResult
    try {
        result = await provider.renderGeneratedFiles(
            {
                apiKey,
                activeTypes,
                availableIntegrations,
                tools: toolDefs,
                activeConnections: readProjectConfig()?.connections ?? {}
            },
            {
                onFetchComplete: () => {
                    s.message("Generating code")
                    codegenTimer.start = performance.now()
                }
            }
        )
    } catch (error) {
        if (error instanceof CliError && error.code === "pinned_connection_missing") {
            s.stop("Pinned connection missing")
        }
        throw error
    }
    const codegenMs = performance.now() - codegenTimer.start

    s.message("Writing generated files")
    writeOutput(result.files, provider)

    const integrationCount = result.integrationSummaries.reduce((sum, summary) => sum + summary.instanceCount, 0)
    s.stop(`Fetched ${integrationCount} integration(s)`)

    const totalMs = performance.now() - totalStart
    const integrationSummary = formatSummaryList(
        result.integrationSummaries.map(summary => labelWithCount(summary.label, summary.instanceCount)),
        10
    )

    if (integrationSummary) {
        console.log(chalk.dim(`Integrations: ${integrationSummary}`))
    }
    if (toolDefs.length > 0) {
        console.log(chalk.dim(`Generated types for ${toolDefs.length} ${toolDefs.length === 1 ? "tool" : "tools"}`))
    }
    const generatedPath = path.relative(process.cwd(), provider.resolveGeneratedCodePath(process.cwd()))
    console.log(
        chalk.dim(
            result.files.length > 1
                ? `Generated ${generatedPath} + ${result.files.length - 1} file(s) under ${path.join(path.dirname(generatedPath), "terse.generated")}/`
                : `Generated ${generatedPath}`
        )
    )
    console.log(chalk.dim(`Codegen: ${codegenMs.toFixed(0)}ms | Total: ${totalMs.toFixed(0)}ms`))
}

function writeOutput(files: GeneratedFile[], provider: LanguageProvider): void {
    const outputDir = path.dirname(provider.resolveGeneratedCodePath(process.cwd()))
    fs.rmSync(path.join(outputDir, "terse.generated"), { recursive: true, force: true })
    for (const file of files) {
        const target = path.join(outputDir, file.fileName)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, file.code)
    }
}

function labelWithCount(label: string, count: number): string {
    return count === 1 ? label : `${label} (${count})`
}

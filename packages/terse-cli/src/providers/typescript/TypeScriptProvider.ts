import chalk from "chalk"
import { exec, execFile, execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import type { CreateJobParameters, SessionStreamEvent } from "terse-sdk"
import { __resetRegisteredTerseInstances, fetchRegisteredJobs } from "terse-sdk"
import type { SerializedEvent, ToolDefinition } from "terse-types"
import { EXTERNAL_INTEGRATION_TYPES, IntegrationType } from "terse-types"
import { tsImport } from "tsx/esm/api"

import { CliError } from "../../cliError.js"
import { ensureDotenvLoaded } from "../../dotenv.js"
import { readProjectConfig } from "../../projectConfig.js"
import type { LanguageProvider } from "../LanguageProvider.js"
import type { CodegenHooks, CodegenResult, CodegenRunInput } from "../codegenTypes.js"
import { printMissingEntryFileGuidance } from "../shared/entryFileGuidance.js"

import { prepareJobSources } from "./jobSources.js"
import { type IntegrationModule, type ModuleOutput, RUN_HISTORY_ACTION_HOIST } from "./modules/IntegrationModule.js"
import { integrationModuleRegistry, terseModule } from "./modules/registry.js"
import { directJobRuntime, durableJobRuntime } from "./runtimes/index.js"
import type { JobRuntime } from "./runtimes/index.js"
import { assembleGeneratedFiles } from "./templateEngine.js"
import { printHoistedShape } from "./typePrinter.js"

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

class TypeScriptProvider implements LanguageProvider {
    readonly language = "typescript" as const
    readonly displayName = "TypeScript"
    readonly detectionMarkers = {
        requiredFiles: ["package.json", "tsconfig.json"],
        description: "TypeScript project"
    }
    readonly projectMarkers = {
        requiredFiles: ["package.json", "tsconfig.json"],
        description: "TypeScript Terse project"
    }
    readonly entryFile = "src/terse.jobs.ts"
    readonly sampleJobFile = "src/jobs/sample-job.ts"
    readonly generatedCodePath = "src/terse.generated.ts"
    readonly deployExclusions = {
        dirs: new Set(["node_modules", ".git", "dist", ".next", ".turbo", ".terse"]),
        files: new Set([".env", ".DS_Store"])
    }

    scaffoldFiles(): Array<{ template: string; output: string }> {
        return [
            { template: "typescript/init/package.json.hbs", output: "package.json" },
            { template: "typescript/init/tsconfig.json.hbs", output: "tsconfig.json" },
            { template: "typescript/init/src/terse.jobs.ts.hbs", output: "src/terse.jobs.ts" },
            { template: "typescript/init/src/jobs/sample-job.ts.hbs", output: "src/jobs/sample-job.ts" },
            { template: "typescript/init/env.example.hbs", output: ".env.example" },
            { template: "typescript/init/gitignore.hbs", output: ".gitignore" },
            { template: "typescript/init/.claude/settings.json.hbs", output: ".claude/settings.json" }
        ]
    }

    buildInitTemplateContext(projectName: string, sdkVersion: string): Record<string, unknown> {
        return { projectName, sdkVersion }
    }

    getPostInitSteps(_packageManager: string): string[] {
        return ["terse test       Run a sample event locally", "terse deploy     Deploy the project"]
    }

    detectPackageManager(): string {
        try {
            execSync("pnpm --version", { stdio: "ignore" })
            return "pnpm"
        } catch {
            return "npm"
        }
    }

    async installDependencies(targetDir: string): Promise<void> {
        const packageManager = this.detectPackageManager()
        await execAsync(`${packageManager} install`, { cwd: targetDir })
    }

    resolveGeneratedCodePath(cwd: string): string {
        return path.join(cwd, fs.existsSync(path.join(cwd, "src")) ? "src/terse.generated.ts" : "terse.generated.ts")
    }

    async renderGeneratedFiles(input: CodegenRunInput, hooks?: CodegenHooks): Promise<CodegenResult> {
        const activeSet = new Set(input.activeTypes)
        const pins = input.activeConnections

        const fetched = await Promise.all(
            EXTERNAL_INTEGRATION_TYPES.map(async type => {
                const module = integrationModuleRegistry[type]
                const instances = activeSet.has(type) ? await module.fetchInstances(input.apiKey).catch(() => []) : []
                return { module, instances }
            })
        )

        for (const { module, instances } of fetched) {
            assertPinExists(module, instances, pins[module.type])
        }

        hooks?.onFetchComplete?.()

        const toolsByIntegration = groupToolsByIntegration(input.tools)
        const moduleOutputs: ModuleOutput[] = [
            await terseModule.render({ instance: undefined, instances: [], tools: toolsByIntegration.get(IntegrationType.TERSE) ?? [] }),
            ...(await Promise.all(
                fetched.map(({ module, instances }) =>
                    module.render({
                        instance: module.selectActiveInstance(instances, pins[module.type]),
                        instances,
                        tools: toolsByIntegration.get(module.type) ?? []
                    })
                )
            ))
        ]

        const commonToolDeclarations = input.tools.length > 0 ? [await printHoistedShape(RUN_HISTORY_ACTION_HOIST, "output")] : []

        const files = assembleGeneratedFiles({
            availableIntegrations: input.availableIntegrations.length > 0 ? input.availableIntegrations.join(", ") : undefined,
            moduleOutputs,
            commonToolDeclarations
        })

        return {
            files,
            integrationSummaries: fetched.filter(entry => entry.instances.length > 0).map(entry => ({ label: entry.module.summaryLabel, instanceCount: entry.instances.length }))
        }
    }

    async typecheck(): Promise<void> {
        const cwd = process.cwd()
        const tscScript = path.join(cwd, "node_modules", "typescript", "bin", "tsc")

        if (!fs.existsSync(tscScript)) {
            throw new CliError("typescript_not_installed", "TypeScript is not installed in this project.", {
                detail: "Install it as a dev dependency, then re-run deploy:\n  npm install --save-dev typescript"
            })
        }

        try {
            await execFileAsync(process.execPath, [tscScript, "--noEmit"], { cwd, maxBuffer: 10 * 1024 * 1024 })
        } catch (error) {
            const e = error as { stdout?: string; stderr?: string }
            const output = ((e.stdout ?? "") + (e.stderr ?? "")).trim()
            throw new CliError("typecheck_failed", "TypeScript compilation check failed.", {
                detail: output || (error instanceof Error ? error.message : String(error))
            })
        }
    }

    async loadJobRegistry(entryFile?: string): Promise<Map<string, CreateJobParameters>> {
        return this.importJobRegistry(entryFile, false)
    }

    private async loadPreparedJobRegistry(entryFile?: string): Promise<Map<string, CreateJobParameters>> {
        return this.importJobRegistry(entryFile, true)
    }

    private async importJobRegistry(entryFile: string | undefined, prepared: boolean): Promise<Map<string, CreateJobParameters>> {
        const cwd = process.cwd()
        const resolvedEntryFile = entryFile ?? resolveTypeScriptEntryFile(cwd)
        const parentURL = pathToFileURL(path.join(cwd, "package.json")).href

        if (!resolvedEntryFile || !fs.existsSync(path.join(cwd, resolvedEntryFile))) {
            printMissingEntryFileGuidance({
                languageDisplayName: this.displayName,
                defaultEntryFile: this.entryFile,
                requestedEntryFile: entryFile,
                overrideExample: "src/server.ts",
                createHint: `Create ${this.entryFile} and have your app startup file import it.`
            })
        }

        const entryPath = prepared ? prepareJobSources({ cwd, entryFile: resolvedEntryFile }) : path.join(cwd, resolvedEntryFile)

        // Clear any Terse instances registered by a previous call in the same
        // process (e.g. the first attempt of a deploy that then retried after
        // re-linking). tsImport re-executes the entry module on each call, so
        // without this reset the retry would see both the old and new instances.
        __resetRegisteredTerseInstances()

        // Load the project .env into process.env so the user's entry file
        // (and any top-level process.env reads) see local values during
        // `terse test`, `terse run`, `terse listen`, and `terse deploy`.
        ensureDotenvLoaded(cwd)

        try {
            await tsImport(pathToFileURL(entryPath).href, parentURL)
        } catch (error) {
            if (isModuleNotFoundError(error)) {
                const missingPackage = extractMissingPackage(error)
                throw new CliError("entry_missing_dependency", `Cannot find package '${missingPackage}' imported from ${resolvedEntryFile}.`, {
                    detail: formatMissingDependencyDetail(missingPackage)
                })
            }

            throw new CliError("entry_import_failed", `Could not import ${resolvedEntryFile}.`, {
                detail: formatErrorDetail(error)
            })
        }

        const registry = fetchRegisteredJobs()

        if (registry.size === 0) {
            throw new CliError("no_jobs_found", `No jobs found after importing ${resolvedEntryFile}.`, {
                detail: "Make sure you call `createJob()` on a Terse instance."
            })
        }

        return registry
    }

    async prebuild(): Promise<void> {
        const cwd = process.cwd()
        const entryFile = resolveTypeScriptEntryFile(cwd)
        if (!entryFile) {
            printMissingEntryFileGuidance({
                languageDisplayName: this.displayName,
                defaultEntryFile: this.entryFile,
                overrideExample: "src/server.ts",
                createHint: `Create ${this.entryFile} and have your app startup file import it.`
            })
        }
        prepareJobSources({ cwd, entryFile })
    }

    runtimeName(job: CreateJobParameters): "durable" | "direct" {
        return isDurableJob(job) ? "durable" : "direct"
    }

    async executeJob(
        job: CreateJobParameters,
        runId: string | null,
        event: SerializedEvent,
        opts?: {
            verbose?: boolean
            entryFile?: string
            projectId?: string
            onSessionEvent?: (event: SessionStreamEvent) => void
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void> {
        const runtime = selectRuntime(job)
        if (runtime === directJobRuntime) return runtime.executeJob(job, runId, event, opts)

        const preparedJob = (await this.loadPreparedJobRegistry(opts?.entryFile)).get(job.name)
        if (!preparedJob) throw new CliError("durable_job_missing", `No transformed durable job was registered with name "${job.name}".`)
        return runtime.executeJob(preparedJob, runId, event, opts)
    }

    async resumeRun(
        runId: string,
        opts?: {
            verbose?: boolean
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void> {
        await this.loadPreparedJobRegistry()
        return durableJobRuntime.resumeRun(runId, opts)
    }

    async resumeRunWithInput(
        runId: string,
        input: { token: string; payload: unknown },
        opts?: {
            verbose?: boolean
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void> {
        await this.loadPreparedJobRegistry()
        return durableJobRuntime.resumeRunWithInput(runId, input, opts)
    }
}

export const typeScriptProvider = new TypeScriptProvider()

function groupToolsByIntegration(tools: readonly ToolDefinition[]): Map<string, ToolDefinition[]> {
    const byIntegration = new Map<string, ToolDefinition[]>()
    for (const tool of tools) {
        const key = tool.integration.toLowerCase()
        byIntegration.set(key, [...(byIntegration.get(key) ?? []), tool])
    }
    return byIntegration
}

function assertPinExists(module: IntegrationModule, instances: readonly unknown[], pinnedId: string | undefined): void {
    if (!pinnedId || instances.length === 0) return
    if (instances.some(instance => module.instanceId(instance) === pinnedId)) return

    throw new CliError("pinned_connection_missing", `The pinned ${module.type} connection '${pinnedId}' was not found in this workspace.`, {
        detail: `Re-pin with \`terse integrate use ${module.type}\`, or remove the pin with \`terse integrate use ${module.type} --clear\`.`
    })
}

// Durability is opt-in per job and unavailable on self-hosted control planes.
function selectRuntime(job: CreateJobParameters): JobRuntime {
    if (job.durable && readProjectConfig()?.selfHosted === true) {
        throw new CliError("durable_self_hosted", `Job "${job.name}" is durable, but durability isn't available on self-hosted control planes yet.`, {
            detail: "Remove `durable: true` from this job, or run it on Terse cloud."
        })
    }
    const durable = isDurableJob(job)
    console.log(chalk.dim(`  Runtime: ${durable ? "durable" : "direct"}`))
    return durable ? durableJobRuntime : directJobRuntime
}

function isDurableJob(job: CreateJobParameters): boolean {
    return job.durable === true && readProjectConfig()?.selfHosted !== true
}

function isModuleNotFoundError(error: unknown): error is Error & { code: string } {
    return error instanceof Error && (error as NodeJS.ErrnoException).code === "ERR_MODULE_NOT_FOUND"
}

function extractMissingPackage(error: Error): string {
    const match = error.message.match(/Cannot find package '([^']+)'/)
    return match?.[1] ?? "unknown"
}

function formatMissingDependencyDetail(missingPackage: string): string {
    if (missingPackage === "terse-sdk") {
        return "Make sure terse-sdk is installed in your project:\n  npm install terse-sdk\n  # or, for local SDK development\n  npm link terse-sdk"
    }

    return `Install the missing package: npm install ${missingPackage}`
}

function formatErrorDetail(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }

    return String(error)
}

function resolveTypeScriptEntryFile(cwd: string): string | null {
    for (const candidate of ["src/terse.jobs.ts", "src/index.ts"]) {
        if (fs.existsSync(path.join(cwd, candidate))) {
            return candidate
        }
    }

    return null
}

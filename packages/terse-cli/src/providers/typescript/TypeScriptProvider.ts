import chalk from "chalk"
import { exec, execFile, execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import type { CreateJobParameters } from "terse-sdk"
import { __resetRegisteredTerseInstances, fetchRegisteredJobs } from "terse-sdk"
import type { SerializedEvent } from "terse-types"
import { tsImport } from "tsx/esm/api"

import { CliError } from "../../cliError.js"
import { ensureDotenvLoaded } from "../../dotenv.js"
import { readProjectConfig } from "../../projectConfig.js"
import type { LanguageProvider } from "../LanguageProvider.js"
import type { CodegenInput } from "../codegenTypes.js"
import { printMissingEntryFileGuidance } from "../shared/entryFileGuidance.js"

import { buildWorkflowArtifacts, expectedWorkflowVersion } from "./durableRuntime.js"
import { prepareTemplateContext } from "./prepareCodegenData.js"
import { type JobRuntime, directJobRuntime, durableJobRuntime } from "./runtimes/index.js"
import { renderGeneratedCode } from "./templateEngine.js"

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
        return { projectName, sdkVersion, workflowVersion: expectedWorkflowVersion() }
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

    renderGeneratedCode(input: CodegenInput): string {
        return renderGeneratedCode(prepareTemplateContext(input))
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

        const entryPath = path.join(cwd, resolvedEntryFile)

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
            await tsImport(entryPath, parentURL)
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
        await buildWorkflowArtifacts(process.cwd())
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
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void> {
        return selectRuntime(job).executeJob(job, runId, event, opts)
    }

    async resumeRun(
        runId: string,
        opts?: {
            verbose?: boolean
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void> {
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
        return durableJobRuntime.resumeRunWithInput(runId, input, opts)
    }
}

export const typeScriptProvider = new TypeScriptProvider()

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

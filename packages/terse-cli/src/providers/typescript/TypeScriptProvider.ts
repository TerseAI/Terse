import chalk from "chalk"
import { exec, execFile, execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import type { CreateJobParameters, SessionStreamEvent } from "terse-sdk"
import { __resetRegisteredTerseInstances, fetchRegisteredJobs, isAgentApprovalHandlingClaimed } from "terse-sdk"
import type { SerializedEvent } from "terse-types"
import { tsImport } from "tsx/esm/api"

import { readApiKeyOrBail } from "../../api.js"
import { CliError } from "../../cliError.js"
import { BACKEND_URL } from "../../config.js"
import { ensureDotenvLoaded } from "../../dotenv.js"
import { isCliRunCommandEnabled } from "../../env.js"
import type { LanguageProvider } from "../LanguageProvider.js"
import type { CodegenInput } from "../codegenTypes.js"
import { printMissingEntryFileGuidance } from "../shared/entryFileGuidance.js"
import { openSessionStream, promptForToolApproval, submitApprovalDecision } from "../shared/sessionStream.js"

import { getDurableRuntime } from "./durableRuntime.js"
import { prepareTemplateContext } from "./prepareCodegenData.js"
import { readRunStatus, resolveWorkflowRunId, rewindFailedRun } from "./rewindRun.js"
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
    readonly generatedCodePath = "src/terse.generated.ts"
    readonly deployExclusions = {
        dirs: new Set(["node_modules", ".git", "dist", ".next", ".turbo"]),
        files: new Set([".env", ".DS_Store"])
    }

    scaffoldFiles(): Array<{ template: string; output: string }> {
        return [
            { template: "typescript/init/package.json.hbs", output: "package.json" },
            { template: "typescript/init/tsconfig.json.hbs", output: "tsconfig.json" },
            { template: "typescript/init/src/terse.jobs.ts.hbs", output: "src/terse.jobs.ts" },
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

    async executeJob(
        job: CreateJobParameters,
        runId: string | null,
        event: SerializedEvent,
        opts?: {
            verbose?: boolean
            entryFile?: string
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void> {
        const isVerbose = opts?.verbose ?? true
        const pauseUiAround = opts?.pauseUiAround ?? (async fn => fn())
        const apiKey = readApiKeyOrBail({
            title: "TERSE_API_KEY is not set.",
            detail: "Please set it in your environment variables."
        })

        try {
            await this.withSession(apiKey, isVerbose, pauseUiAround, async sessionId => {
                if (isVerbose) {
                    console.log(chalk.cyan(`  Job "${job.name}" started`))
                }
                const rt = await getDurableRuntime(process.cwd())
                await rt.dispatchJob(job.name, { sessionId, runId, apiBaseUrl: BACKEND_URL }, event)
            })
        } catch (error) {
            if (error instanceof CliError) throw error
            throw new CliError("job_execution_failed", `Job "${job.name}" threw an error.`, {
                detail: formatErrorDetail(error)
            })
        }
    }

    async resumeRun(
        runId: string,
        opts?: {
            verbose?: boolean
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void> {
        const isVerbose = opts?.verbose ?? true
        const pauseUiAround = opts?.pauseUiAround ?? (async fn => fn())
        const apiKey = readApiKeyOrBail({
            title: "TERSE_API_KEY is not set.",
            detail: "Please set it in your environment variables."
        })

        const dataDir = process.env.WORKFLOW_LOCAL_DATA_DIR ?? path.join(process.cwd(), ".terse", "data")
        const workflowRunId = resolveWorkflowRunId(dataDir, runId)
        const status = readRunStatus(dataDir, workflowRunId)

        try {
            await this.withSession(apiKey, isVerbose, pauseUiAround, async () => {
                // A terminally failed run must be rewound (its run_failed marker trimmed)
                // before the runtime starts, so recovery re-enqueues it as a live run.
                if (status === "failed") {
                    const { rewoundStepId } = rewindFailedRun(dataDir, workflowRunId)
                    if (isVerbose) console.log(chalk.yellow(`  Re-driving failed run ${workflowRunId}${rewoundStepId ? " from the failed step" : ""}; completed steps replay from the journal`))
                } else if (isVerbose) {
                    console.log(chalk.cyan(`  Resuming run ${workflowRunId}`))
                }
                const rt = await getDurableRuntime(process.cwd())
                await rt.resumeRun(workflowRunId)
                if (isVerbose) console.log(chalk.green(`  Run ${workflowRunId} completed`))
            })
        } catch (error) {
            if (error instanceof CliError) throw error
            throw new CliError("run_resume_failed", `Run "${runId}" could not be resumed.`, {
                detail: formatErrorDetail(error)
            })
        }
    }

    // Holds a session stream open (for tool-approval routing) for the duration of
    // `action`. A durable run reads its session id from its seeded attributes, so a
    // resumed run keeps its original session id; routing approvals across a resume
    // is a follow-up.
    private async withSession<T>(apiKey: string, isVerbose: boolean, pauseUiAround: <U>(fn: () => Promise<U>) => Promise<U>, action: (sessionId: string) => Promise<T>): Promise<T> {
        // Track the latest agent run id seen on the session stream so we can
        // pair an incoming tool_approval_requested with the right run. The
        // backend's approval gate keys decisions on (runId, stepId, orgId);
        // tool_approval_requested itself only carries stepId, so we read
        // runId from the most recent run_started in this session.
        let latestRunId: string | null = null

        const handleSessionEvent = async (event: SessionStreamEvent): Promise<void> => {
            if (event.type === "run_started") {
                latestRunId = event.runId
                return
            }
            if (event.type !== "tool_approval_requested") return

            if (isCliRunCommandEnabled()) return

            // If a TerseAgent in this process defined its own onApprovalRequired,
            // it will handle and submit the decision on its own SSE stream.
            // Skip here to avoid double-prompting and duplicate decision posts.
            if (isAgentApprovalHandlingClaimed()) return

            const runId = latestRunId
            if (!runId) {
                console.error(chalk.red("  Received approval request before run_started — cannot route decision."))
                return
            }

            const { toolName, arguments: rawArguments, stepId } = event.toolApprovalRequested

            if (!process.stdout.isTTY) {
                console.error(chalk.red(`  Approval required for "${toolName}" but no TTY is attached — auto-rejecting.`))
                console.error(chalk.dim("  In non-interactive contexts, set TerseAgent.onApprovalRequired in your job code."))
                try {
                    await submitApprovalDecision(apiKey, { runId, stepId, approved: false })
                } catch (error) {
                    console.error(chalk.red(`  Failed to submit auto-reject: ${(error as Error).message}`))
                }
                return
            }

            sessionPaused = true
            try {
                await pauseUiAround(async () => {
                    const approved = await promptForToolApproval(toolName, rawArguments)
                    await submitApprovalDecision(apiKey, { runId, stepId, approved })
                })
            } catch (error) {
                console.error(chalk.red(`  Failed to submit approval decision: ${(error as Error).message}`))
            } finally {
                sessionPaused = false
            }
        }

        const session = await openSessionStream(apiKey, {
            verbose: isVerbose,
            isPaused: () => sessionPaused,
            onEvent: handleSessionEvent
        })

        try {
            return await action(session.sessionId)
        } finally {
            session.close?.()
        }
    }
}

export const typeScriptProvider = new TypeScriptProvider()

let sessionPaused = false

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

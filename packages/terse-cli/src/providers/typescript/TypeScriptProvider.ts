import chalk from "chalk"
import { exec, execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import type { ApprovalRequestInfo, CreateJobParameters } from "terse-sdk"
import { TerseAgent, createSDKTrigger } from "terse-sdk"
import type { SerializedEvent } from "terse-types"
import { tsImport } from "tsx/esm/api"

import { BACKEND_URL } from "../../config.js"
import type { LanguageProvider } from "../LanguageProvider.js"
import type { CodegenInput } from "../codegenTypes.js"
import { openSessionStream, promptForToolApproval } from "../shared/sessionStream.js"

import { prepareTemplateContext } from "./prepareCodegenData.js"
import { renderGeneratedCode } from "./templateEngine.js"

const execAsync = promisify(exec)

export class TypeScriptProvider implements LanguageProvider {
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

    buildInitTemplateContext(projectName: string): Record<string, unknown> {
        return { projectName }
    }

    getPostInitSteps(packageManager: string): string[] {
        return [`${packageManager} run build    Build the project`, `${packageManager} run dev      Run in development mode`]
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

    async loadJobRegistry(entryFile?: string): Promise<Map<string, CreateJobParameters>> {
        const cwd = process.cwd()
        const resolvedEntryFile = entryFile ?? resolveTypeScriptEntryFile(cwd)
        const parentURL = pathToFileURL(path.join(cwd, "package.json")).href

        if (!resolvedEntryFile) {
            console.error(chalk.red("Error: Could not find a Terse jobs entry file."))
            console.error(chalk.dim(`Create ${this.entryFile} and have your app startup file import it.`))
            console.error(chalk.dim("Legacy projects can continue using src/index.ts for now."))
            process.exit(1)
        }

        const entryPath = path.join(cwd, resolvedEntryFile)

        try {
            await tsImport(entryPath, parentURL)
        } catch (error) {
            if (isModuleNotFoundError(error)) {
                const missingPackage = extractMissingPackage(error)
                console.error(chalk.red(`Error: Cannot find package '${missingPackage}' imported from ${resolvedEntryFile}`))
                if (missingPackage === "terse-sdk") {
                    console.error(chalk.dim("\nMake sure terse-sdk is installed in your project:"))
                    console.error(chalk.dim("  npm install terse-sdk"))
                    console.error(chalk.dim("  # or, for local SDK development"))
                    console.error(chalk.dim("  npm link terse-sdk"))
                } else {
                    console.error(chalk.dim(`\nInstall the missing package: npm install ${missingPackage}`))
                }
            } else {
                console.error(chalk.red(`Error importing ${resolvedEntryFile}:\n`))
                console.error(error)
            }
            process.exit(1)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const registry = (globalThis as any).__terse_jobRegistry as Map<string, CreateJobParameters> | undefined

        if (!registry || registry.size === 0) {
            console.error(chalk.red(`No jobs found after importing ${resolvedEntryFile}.`))
            console.error(chalk.dim("Make sure this file, or something it imports, calls client.createJob()."))
            process.exit(1)
        }

        return registry
    }

    async executeJob(job: CreateJobParameters, event: SerializedEvent, opts?: { verbose?: boolean; entryFile?: string }): Promise<void> {
        const isVerbose = opts?.verbose ?? false

        const serializedEventRuntime = createSDKTrigger(event)

        const apiKey = process.env.TERSE_API_KEY ?? null
        let sessionId: string | undefined
        let closeSession: (() => void) | undefined

        if (isVerbose && apiKey) {
            const session = await openSessionStream(apiKey, {
                verbose: true,
                isPaused: () => sessionPaused
            })
            sessionId = session.sessionId
            closeSession = session.close
        }

        const agent = TerseAgent.fromJob(job, { apiBaseUrl: BACKEND_URL, sessionId })

        const isSandbox = !!process.env.TERSE_RUN_ID
        if (!isSandbox) {
            agent.onApprovalRequired = async (info: ApprovalRequestInfo) => {
                sessionPaused = true
                try {
                    return await promptForToolApproval(info.toolName, info.arguments)
                } finally {
                    sessionPaused = false
                }
            }
        }

        try {
            if (job.filter) {
                const shouldRun = await job.filter(serializedEventRuntime)
                if (!shouldRun) {
                    console.log(chalk.dim(`\n  Job "${job.name}" skipped (filter returned false).\n`))
                    return
                }
            }

            if (isVerbose) {
                console.log(chalk.cyan(`  Job "${job.name}" started`))
            }
            await job.onTrigger(serializedEventRuntime, agent)
            console.log(chalk.green(`\n  Job "${job.name}" completed successfully.\n`))
        } catch (error) {
            console.error(chalk.red(`\n  Job "${job.name}" threw an error:\n`))
            console.error(error)
            process.exit(1)
        } finally {
            closeSession?.()
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

function resolveTypeScriptEntryFile(cwd: string): string | null {
    for (const candidate of ["src/terse.jobs.ts", "src/index.ts"]) {
        if (fs.existsSync(path.join(cwd, candidate))) {
            return candidate
        }
    }

    return null
}

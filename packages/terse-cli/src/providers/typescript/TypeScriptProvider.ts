import { exec, execSync } from "node:child_process"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { promisify } from "node:util"
import chalk from "chalk"
import { tsImport } from "tsx/esm/api"
import type { ApprovalRequestInfo, CreateJobParameters } from "terse-sdk"
import { TerseAgent } from "terse-sdk"
import { BACKEND_URL } from "../../config.js"
import type { SerializedEvent } from "../../shared/types.js"
import { convertSerializedEventToInputEvent } from "../../util.js"
import type { LanguageProvider } from "../LanguageProvider.js"
import type { CodegenInput } from "../codegenTypes.js"
import { openSessionStream, promptForToolApproval } from "../shared/sessionStream.js"
import { prepareTemplateContext } from "./prepareCodegenData.js"
import { renderGeneratedCode } from "./templateEngine.js"

const execAsync = promisify(exec)

export class TypeScriptProvider implements LanguageProvider {
    readonly language = "typescript" as const
    readonly displayName = "TypeScript"
    readonly projectMarkers = {
        requiredFiles: ["package.json", "src/index.ts"],
        description: "TypeScript Terse project",
    }
    readonly entryFile = "src/index.ts"
    readonly generatedCodePath = "src/terse.generated.ts"
    readonly deployExclusions = {
        dirs: new Set(["node_modules", ".git", "dist", ".next", ".turbo"]),
        files: new Set([".env", ".DS_Store"]),
    }

    scaffoldFiles(): Array<{ template: string; output: string }> {
        return [
            { template: "typescript/init/package.json.hbs", output: "package.json" },
            { template: "typescript/init/tsconfig.json.hbs", output: "tsconfig.json" },
            { template: "typescript/init/src/index.ts.hbs", output: "src/index.ts" },
            { template: "typescript/init/env.example.hbs", output: ".env.example" },
            { template: "typescript/init/gitignore.hbs", output: ".gitignore" },
            { template: "typescript/init/.claude/settings.json.hbs", output: ".claude/settings.json" },
        ]
    }

    buildInitTemplateContext(projectName: string): Record<string, unknown> {
        return { projectName }
    }

    getPostInitSteps(packageManager: string): string[] {
        return [
            `${packageManager} run build    Build the project`,
            `${packageManager} run dev      Run in development mode`,
        ]
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

    renderGeneratedCode(input: CodegenInput): string {
        return renderGeneratedCode(prepareTemplateContext(input))
    }

    async loadJobRegistry(): Promise<Map<string, CreateJobParameters>> {
        const cwd = process.cwd()
        const entryPath = path.join(cwd, this.entryFile)
        const parentURL = pathToFileURL(path.join(cwd, "package.json")).href

        try {
            await tsImport(entryPath, parentURL)
        } catch (error) {
            if (isModuleNotFoundError(error)) {
                const missingPackage = extractMissingPackage(error)
                console.error(chalk.red(`Error: Cannot find package '${missingPackage}' imported from ${this.entryFile}`))
                if (missingPackage === "terse-sdk") {
                    console.error(chalk.dim("\nMake sure terse-sdk is installed in your project:"))
                    console.error(chalk.dim("  npm install terse-sdk"))
                    console.error(chalk.dim("  # or, for local SDK development"))
                    console.error(chalk.dim("  npm link terse-sdk"))
                } else {
                    console.error(chalk.dim(`\nInstall the missing package: npm install ${missingPackage}`))
                }
            } else {
                console.error(chalk.red(`Error importing ${this.entryFile}:\n`))
                console.error(error)
            }
            process.exit(1)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const registry = (globalThis as any).__terse_jobRegistry as
            | Map<string, CreateJobParameters>
            | undefined

        if (!registry || registry.size === 0) {
            console.error(chalk.red(`No jobs found. Make sure your ${this.entryFile} calls client.createJob().`))
            process.exit(1)
        }

        return registry
    }

    async executeJob(
        job: CreateJobParameters,
        event: SerializedEvent,
        opts?: { verbose?: boolean }
    ): Promise<void> {
        const inputEvent = convertSerializedEventToInputEvent(event)
        const isVerbose = opts?.verbose ?? false

        const apiKey = process.env.TERSE_API_KEY ?? null
        let sessionId: string | undefined
        let closeSession: (() => void) | undefined

        if (isVerbose && apiKey) {
            const session = await openSessionStream(apiKey, {
                verbose: true,
                isPaused: () => sessionPaused,
            })
            sessionId = session.sessionId
            closeSession = session.close
        }

        const agent = new TerseAgent(job.skills, BACKEND_URL, sessionId, job.toolApprovals)
        agent.manualToolConfigs = [...job.skills, ...job.triggers]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createTools = (globalThis as any).__terse_createTools as ((agent: TerseAgent) => unknown) | undefined
        if (createTools) {
            Object.defineProperty(agent, "tools", { value: createTools(agent) })
        }

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
                const shouldRun = await job.filter(inputEvent)
                if (!shouldRun) {
                    console.log(chalk.dim(`\n  Job "${job.name}" skipped (filter returned false).\n`))
                    return
                }
            }

            if (isVerbose) {
                console.log(chalk.cyan(`  Job "${job.name}" started`))
            }
            await job.onTrigger(inputEvent, agent)
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

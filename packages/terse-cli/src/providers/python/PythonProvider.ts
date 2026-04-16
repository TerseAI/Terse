import chalk from "chalk"
import { execFileSync, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { CreateJobParameters, TypedTrigger } from "terse-sdk"
import type { SerializedEvent } from "terse-types"

import type { LanguageProvider } from "../LanguageProvider.js"
import type { CodegenInput } from "../codegenTypes.js"
import { printMissingEntryFileGuidance } from "../shared/entryFileGuidance.js"
import { type SessionStreamEvent, openSessionStream, promptForToolApproval, submitApprovalDecision } from "../shared/sessionStream.js"
import { ensureUvAvailable, execUv, loadDotenv, withTempScript } from "../shared/shellUtils.js"

import { preparePythonTemplateContext } from "./preparePythonCodegenData.js"
import { renderPythonGeneratedCode } from "./pythonTemplateEngine.js"

const JOB_REGISTRY_MARKER = "__TERSE_JOB_REGISTRY__="
const JOB_SKIPPED_MARKER = "__TERSE_SKIPPED__"

type PythonSerializedConfig = {
    integrationId: string
    integrationType: string
    configType: string
    [key: string]: unknown
}

type PythonJobData = {
    name: string
    triggers: PythonSerializedConfig[]
    skills: PythonSerializedConfig[]
    toolApprovals: string[]
    hasFilter: boolean
}

type ApprovalState = {
    paused: boolean
    runId?: string
}

export class PythonProvider implements LanguageProvider {
    readonly language = "python" as const
    readonly displayName = "Python"
    readonly detectionMarkers = {
        requiredFiles: ["pyproject.toml"],
        description: "Python project"
    }
    readonly projectMarkers = {
        requiredFiles: ["pyproject.toml"],
        description: "Python Terse project"
    }
    readonly entryFile = "src/main.py"
    readonly generatedCodePath = "src/terse_generated.py"
    readonly deployExclusions = {
        dirs: new Set([".venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".git"]),
        files: new Set([".env", ".DS_Store"])
    }

    scaffoldFiles(): Array<{ template: string; output: string }> {
        return [
            { template: "python/init/pyproject.toml.hbs", output: "pyproject.toml" },
            { template: "python/init/src/main.py.hbs", output: "src/main.py" },
            { template: "python/init/.python-version.hbs", output: ".python-version" },
            { template: "python/init/env.example.hbs", output: ".env.example" },
            { template: "python/init/gitignore.hbs", output: ".gitignore" },
            { template: "python/init/README.md.hbs", output: "README.md" }
        ]
    }

    buildInitTemplateContext(projectName: string, sdkVersion: string): Record<string, unknown> {
        return {
            projectName,
            sdkDependency: `terse-sdk==${sdkVersion}`
        }
    }

    getPostInitSteps(_packageManager: string): string[] {
        return ["uv run ty check  Type-check the project", "terse test       Run a sample event locally"]
    }

    detectPackageManager(): string {
        return "uv"
    }

    async installDependencies(targetDir: string): Promise<void> {
        await this.execUvCommand(["sync"], { cwd: targetDir, env: this.buildPythonEnv(targetDir) })
    }

    resolveGeneratedCodePath(cwd: string): string {
        return path.join(cwd, fs.existsSync(path.join(cwd, "src")) ? "src/terse_generated.py" : "terse_generated.py")
    }

    renderGeneratedCode(input: CodegenInput): string {
        const code = renderPythonGeneratedCode(preparePythonTemplateContext(input))
        validatePythonSyntax(code)
        return code
    }

    async loadJobRegistry(entryFile?: string): Promise<Map<string, CreateJobParameters>> {
        const cwd = process.cwd()
        const env = this.buildPythonEnv(cwd)
        const resolvedEntryFile = entryFile ?? this.entryFile
        const entryPath = path.join(cwd, resolvedEntryFile)

        if (!fs.existsSync(entryPath)) {
            printMissingEntryFileGuidance({
                languageDisplayName: this.displayName,
                defaultEntryFile: this.entryFile,
                requestedEntryFile: entryFile,
                overrideExample: "src/server.py",
                createHint: `Create ${this.entryFile} and register at least one job with @app.job(...).`
            })
        }

        try {
            const script = this.buildLoadRegistryScript(resolvedEntryFile)
            return await this.withTempPythonScript(script, async scriptPath => {
                const { stdout } = await this.execUvCommand(["run", "python", scriptPath], { cwd, env })
                const payload = extractRegistryPayload(stdout)
                const parsed = JSON.parse(payload) as Record<string, PythonJobData>
                const registry = new Map<string, CreateJobParameters>()

                for (const [name, data] of Object.entries(parsed)) {
                    registry.set(name, createJobParametersFromPython(data))
                }

                if (registry.size === 0) {
                    console.error(chalk.red(`No jobs found. Make sure your ${resolvedEntryFile} registers at least one job with @app.job(...).`))
                    process.exit(1)
                }

                return registry
            })
        } catch (error) {
            console.error(chalk.red(`Error importing ${resolvedEntryFile}:\n`))
            printPythonCommandError(error)
            process.exit(1)
        }
    }

    async executeJob(job: CreateJobParameters, event: SerializedEvent, opts?: { verbose?: boolean; entryFile?: string }): Promise<void> {
        const cwd = process.cwd()
        const env: NodeJS.ProcessEnv = {
            ...this.buildPythonEnv(cwd),
            TERSE_JOB_NAME: job.name,
            TERSE_EVENT_JSON: JSON.stringify(event)
        }
        const isVerbose = opts?.verbose ?? false
        const resolvedEntryFile = opts?.entryFile ?? this.entryFile
        const isSandbox = !!process.env.TERSE_RUN_ID
        const apiKey = env.TERSE_API_KEY ?? null
        const approvalState: ApprovalState = { paused: false }

        let closeSession: (() => void) | undefined
        try {
            if (apiKey && (isVerbose || !isSandbox)) {
                const session = await openSessionStream(apiKey, {
                    verbose: isVerbose,
                    isPaused: () => approvalState.paused,
                    onEvent: !isSandbox ? createApprovalHandler(apiKey, approvalState) : undefined
                })
                closeSession = session.close
                env.TERSE_SESSION_ID = session.sessionId
            }

            const script = this.buildExecuteJobScript(resolvedEntryFile)
            await this.ensureUvAvailable(cwd)
            await this.withTempPythonScript(script, async scriptPath => {
                await runStreamingPython(cwd, env, scriptPath, job.name)
            })
        } catch (error) {
            console.error(chalk.red(`\n  Job "${job.name}" failed.\n`))
            printPythonCommandError(error)
            process.exit(1)
        } finally {
            closeSession?.()
        }
    }

    protected buildPythonEnv(cwd: string): NodeJS.ProcessEnv {
        return {
            ...loadDotenv(cwd),
            UV_CACHE_DIR: path.join(os.tmpdir(), "terse-uv-cache")
        }
    }

    protected async execUvCommand(
        args: string[],
        opts: {
            cwd: string
            env?: NodeJS.ProcessEnv
        }
    ): Promise<{ stdout: string; stderr: string }> {
        return execUv(args, opts)
    }

    protected async withTempPythonScript<T>(source: string, fn: (scriptPath: string) => Promise<T>): Promise<T> {
        return withTempScript(source, ".py", fn)
    }

    protected async ensureUvAvailable(cwd: string): Promise<void> {
        await ensureUvAvailable(cwd)
    }

    protected buildLoadRegistryScript(entryFile: string): string {
        return buildLoadRegistryScript(entryFile)
    }

    protected buildExecuteJobScript(entryFile: string): string {
        return buildExecuteJobScript(entryFile)
    }
}

export const pythonProvider = new PythonProvider()

function createJobParametersFromPython(data: PythonJobData): CreateJobParameters {
    const jobParams: CreateJobParameters = {
        name: data.name,
        triggers: (data.triggers ?? []).map(reconstructPythonConfig) as TypedTrigger[],
        onTrigger: async () => {
            throw new Error("Python job execution must go through provider.executeJob()")
        },
        filter: data.hasFilter
            ? async () => {
                  throw new Error("Python filter execution must go through provider.executeJob()")
              }
            : undefined
    }

    return jobParams
}

function reconstructPythonConfig(config: PythonSerializedConfig) {
    return {
        ...config,
        isComplete: () => true,
        formatForAgent: () => JSON.stringify(config)
    }
}

function buildLoadRegistryScript(entryFile: string): string {
    return `
import importlib.util
import json
import os
import sys
import uuid

from terse_sdk import clear_job_registry, get_job_registry

PROJECT_ROOT = os.getcwd()
SRC_DIR = os.path.join(PROJECT_ROOT, "src")
ENTRY_FILE = ${JSON.stringify(entryFile)}
sys.path[:0] = [PROJECT_ROOT, SRC_DIR]

clear_job_registry()
module_name = f"__terse_main_{uuid.uuid4().hex}"
spec = importlib.util.spec_from_file_location(module_name, os.path.join(PROJECT_ROOT, ENTRY_FILE))
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not create an import spec for {ENTRY_FILE}.")

module = importlib.util.module_from_spec(spec)
sys.modules[module_name] = module
spec.loader.exec_module(module)

registry = get_job_registry()
result = {}
for name, job in registry.items():
    def serialize_config(config):
        payload = dict(config.config)
        payload["integrationId"] = config.integration_id
        payload["integrationType"] = config.integration_type
        payload["configType"] = config.config_type
        return payload

    result[name] = {
        "name": name,
        "triggers": [serialize_config(trigger) for trigger in job.triggers],
        "hasFilter": job.filter is not None,
    }

print(${JSON.stringify(JOB_REGISTRY_MARKER)} + json.dumps(result))
`.trim()
}

function buildExecuteJobScript(entryFile: string): string {
    return `
import importlib.util
import json
import os
import sys
import uuid

from terse_sdk import clear_job_registry, deserialize_input_event, execute_registered_job, get_job_registry

PROJECT_ROOT = os.getcwd()
SRC_DIR = os.path.join(PROJECT_ROOT, "src")
ENTRY_FILE = ${JSON.stringify(entryFile)}
sys.path[:0] = [PROJECT_ROOT, SRC_DIR]

clear_job_registry()
module_name = f"__terse_main_{uuid.uuid4().hex}"
spec = importlib.util.spec_from_file_location(module_name, os.path.join(PROJECT_ROOT, ENTRY_FILE))
if spec is None or spec.loader is None:
    raise RuntimeError(f"Could not create an import spec for {ENTRY_FILE}.")

module = importlib.util.module_from_spec(spec)
sys.modules[module_name] = module
spec.loader.exec_module(module)

registry = get_job_registry()
job_name = os.environ["TERSE_JOB_NAME"]
event = deserialize_input_event(json.loads(os.environ["TERSE_EVENT_JSON"]))
# TERSE_SESSION_ID / TERSE_RUN_ID are read by TerseAgent.__init__ when the
# user's handler constructs an agent, so the outgoing /sdk/agent-run request
# carries the right headers for the CLI's session stream to receive events.
job = registry[job_name]
skipped = execute_registered_job(job, event)
if skipped:
    print(${JSON.stringify(JOB_SKIPPED_MARKER)})
`.trim()
}

function extractRegistryPayload(stdout: string): string {
    const line = stdout
        .split(/\r?\n/)
        .map(entry => entry.trim())
        .filter(Boolean)
        .reverse()
        .find(entry => entry.startsWith(JOB_REGISTRY_MARKER))

    if (!line) {
        throw new Error("Python job loader did not return registry JSON.")
    }

    return line.slice(JOB_REGISTRY_MARKER.length)
}

function createApprovalHandler(apiKey: string, state: ApprovalState) {
    return async (event: SessionStreamEvent) => {
        if (event.type === "run_started") {
            state.runId = event.runId
            return
        }

        if (event.type !== "tool_approval_requested") return
        if (!state.runId) {
            throw new Error("Received tool approval request before run_started.")
        }

        state.paused = true
        try {
            const info = event.toolApprovalRequested
            const approved = await promptForToolApproval(info.toolName, info.arguments)
            await submitApprovalDecision(apiKey, {
                runId: state.runId,
                stepId: info.stepId,
                approved
            })
        } finally {
            state.paused = false
        }
    }
}

async function runStreamingPython(cwd: string, env: NodeJS.ProcessEnv, scriptPath: string, jobName: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child = spawn("uv", ["run", "python", scriptPath], {
            cwd,
            env,
            stdio: ["ignore", "pipe", "pipe"]
        })

        let skipped = false
        let stdoutBuffer = ""

        child.stdout.on("data", (chunk: Buffer) => {
            stdoutBuffer += chunk.toString()
            stdoutBuffer = flushStdoutBuffer(stdoutBuffer, line => {
                if (line === JOB_SKIPPED_MARKER) {
                    skipped = true
                    return
                }
                process.stdout.write(`${line}\n`)
            })
        })

        child.stdout.on("end", () => {
            if (!stdoutBuffer) return
            if (stdoutBuffer === JOB_SKIPPED_MARKER) {
                skipped = true
                return
            }
            process.stdout.write(stdoutBuffer)
        })

        child.stderr.on("data", (chunk: Buffer) => {
            process.stderr.write(chunk)
        })

        child.on("error", reject)
        child.on("close", code => {
            if (code !== 0) {
                reject(new Error(`uv run python exited with code ${code ?? "unknown"}`))
                return
            }

            if (skipped) {
                console.log(chalk.dim(`\n  Job "${jobName}" skipped (filter returned false).\n`))
            }
            resolve()
        })
    })
}

function flushStdoutBuffer(buffer: string, onLine: (line: string) => void): string {
    let newlineIndex = buffer.indexOf("\n")
    while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "")
        onLine(line)
        buffer = buffer.slice(newlineIndex + 1)
        newlineIndex = buffer.indexOf("\n")
    }
    return buffer
}

function validatePythonSyntax(code: string): void {
    for (const executable of ["python3", "python"]) {
        try {
            execFileSync(executable, ["-c", "import sys; compile(sys.stdin.read(), 'terse_generated.py', 'exec')"], {
                input: code,
                stdio: ["pipe", "ignore", "pipe"]
            })
            return
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code
            if (code === "ENOENT") continue

            const stderr = Buffer.isBuffer((error as { stderr?: unknown }).stderr) ? (error as { stderr: Buffer }).stderr.toString().trim() : ""
            if (stderr) {
                console.warn(chalk.yellow(`Warning: generated Python did not pass syntax validation.\n${stderr}`))
            } else {
                console.warn(chalk.yellow("Warning: generated Python did not pass syntax validation."))
            }
            return
        }
    }
}

function printPythonCommandError(error: unknown): void {
    if (error instanceof Error) {
        console.error(error.message)
        const stderr = (error as { stderr?: unknown }).stderr
        if (typeof stderr === "string" && stderr.trim()) {
            console.error(stderr.trim())
        } else if (Buffer.isBuffer(stderr) && stderr.toString().trim()) {
            console.error(stderr.toString().trim())
        }
        return
    }

    console.error(String(error))
}

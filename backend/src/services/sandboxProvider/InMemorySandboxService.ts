import dotenv from "dotenv"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { inspect } from "node:util"
import type { SerializedEvent } from "terse-types"

import logger from "../../common/logger"
import { parseSerializedTriggerPayload } from "../../common/triggerPayload"
import { db } from "../../loaders/prisma"
import { settings } from "../../settings"

import { ContainerProcess, Sandbox, SandboxApp, SandboxFile, SandboxImage, SandboxService } from "./SandboxService"

const FAKE_APP_ID = "in-memory-app"
const FAKE_IMAGE_ID = "in-memory-image"

const TERSE_RUN_PATTERN = /\bnpx\s+terse\s+run\s+(\S+)/
const DEFAULT_ENTRY_FILES = ["src/terse.jobs.ts", "src/index.ts"]

type LocalJob = {
    name?: string
    filter?: (event: unknown) => boolean | Promise<boolean>
    onTrigger: (event: unknown) => unknown | Promise<unknown>
}

type LocalTerseSdk = {
    __resetRegisteredTerseInstances?: () => void
    fetchRegisteredJobs: () => Map<string, LocalJob>
    createSDKTrigger: (event: SerializedEvent) => unknown
    runWithJobContext: <T>(ctx: { sessionId: string; runId: string | null; apiBaseUrl: string }, fn: () => T | Promise<T>) => T | Promise<T>
}

/**
 * In-memory sandbox for self-host single-user mode. The user's job code is
 * imported as a normal Node module instead of running inside a container.
 *
 * Most SandboxService methods are no-ops (no images, no filesystems). The only
 * real work happens in `exec`: it parses the shell command, recognizes the
 * `npx terse run <jobName>` pattern, and invokes the imported job handler.
 *
 * Container-only paths (image-build pipelines, ClaudeCodeSandboxService) must
 * feature-gate themselves on `supportsContainerizedRunners` — InMemory returns false.
 */
export class InMemorySandboxService implements SandboxService<SandboxImage, InMemorySandbox> {
    readonly supportsContainerizedRunners = false

    async getOrCreateApp(name: string): Promise<SandboxApp> {
        return { appId: FAKE_APP_ID, name }
    }

    getImageFromRegistry(_registry: string): SandboxImage {
        return { imageId: FAKE_IMAGE_ID }
    }

    async getImageFromId(imageId: string): Promise<SandboxImage> {
        return { imageId }
    }

    async deleteImage(_imageId: string): Promise<void> {
        // No-op — no images exist.
    }

    async getOrCreateSandbox(_app: SandboxApp, _image: SandboxImage, uniqueName: string): Promise<InMemorySandbox> {
        return new InMemorySandbox(uniqueName)
    }
}

// ─────────────── helpers (bottom) ───────────────

export class InMemorySandbox implements Sandbox {
    constructor(readonly sandboxId: string) {}

    async exec(command: string[], params?: { env?: Record<string, string> }): Promise<ContainerProcess> {
        return new InMemoryProcess(command, params?.env ?? {})
    }

    async open(_path: string, _mode: "r" | "w"): Promise<SandboxFile> {
        return new NoOpFile()
    }

    async terminate(): Promise<void> {
        // No-op
    }

    async snapshotFilesystem(): Promise<{ imageId: string }> {
        return { imageId: FAKE_IMAGE_ID }
    }
}

class InMemoryProcess implements ContainerProcess {
    private stdinBuffer = ""
    private stdoutBuffer = ""
    private stderrBuffer = ""
    private resultPromise: Promise<number> | null = null

    constructor(
        private readonly command: string[],
        private readonly env: Record<string, string>
    ) {}

    get stdin() {
        return {
            writeText: async (text: string) => {
                this.stdinBuffer += text
            },
            writeBytes: async (bytes: Uint8Array) => {
                this.stdinBuffer += new TextDecoder().decode(bytes)
            }
        }
    }

    get stdout() {
        return this.makeStream(() => this.stdoutBuffer)
    }

    get stderr() {
        return this.makeStream(() => this.stderrBuffer)
    }

    async wait(): Promise<number> {
        if (!this.resultPromise) {
            this.resultPromise = this.run()
        }
        return this.resultPromise
    }

    private makeStream(getContent: () => string) {
        const waitForCompletion = () => this.wait()
        return {
            readText: async () => {
                await waitForCompletion()
                return getContent()
            },
            readBytes: async () => {
                await waitForCompletion()
                return new TextEncoder().encode(getContent())
            },
            getReader: () =>
                new InMemoryReader(async () => {
                    await waitForCompletion()
                    return getContent()
                })
        }
    }

    private async run(): Promise<number> {
        const shellCommand = this.command[0] === "sh" && this.command[1] === "-c" ? this.command[2] : this.command.join(" ")

        const runMatch = shellCommand.match(TERSE_RUN_PATTERN)
        if (runMatch) {
            return this.runUserJob(unquoteShellToken(runMatch[1]))
        }

        // Anything else (mkdir, npm install, git init, chown, ...) is image-build
        // noise that doesn't need to actually execute — there's no container.
        logger.debug("[InMemorySandbox] No-op exec (not a job run)", { command: shellCommand })
        return 0
    }

    private async runUserJob(jobName: string): Promise<number> {
        try {
            const packageRoot = resolveLocalSdkPackagePath()
            const sdk = await loadLocalTerseSdk(packageRoot)
            const entryPath = resolveLocalEntryPath(packageRoot)
            const event = await this.resolveEvent()

            await this.withProcessState(packageRoot, async () => {
                sdk.__resetRegisteredTerseInstances?.()
                const { tsImport } = await loadTsxApi(packageRoot)
                await tsImport(entryPath, pathToFileURL(path.join(packageRoot, "package.json")).href)

                const job = sdk.fetchRegisteredJobs().get(jobName)
                if (!job) {
                    throw new Error(`Job "${jobName}" not found. Available jobs: ${[...sdk.fetchRegisteredJobs().keys()].join(", ") || "(none)"}`)
                }

                const runtimeEvent = sdk.createSDKTrigger(event)
                const runId = this.env.TERSE_RUN_ID ?? process.env.TERSE_RUN_ID ?? null
                const apiBaseUrl = this.env.TERSE_BACKEND_URL ?? process.env.TERSE_BACKEND_URL ?? settings.urls.backend

                await this.captureConsoleOutput(async () => {
                    await sdk.runWithJobContext({ sessionId: randomUUID(), runId, apiBaseUrl }, async () => {
                        if (job.filter) {
                            const shouldRun = await job.filter(runtimeEvent)
                            if (!shouldRun) return
                        }

                        await job.onTrigger(runtimeEvent)
                    })
                })
            })

            return 0
        } catch (error) {
            const message = formatError(error)
            this.stderrBuffer += this.stderrBuffer ? `\n${message}` : message
            logger.error("[InMemorySandbox] Job invocation failed", { jobName, error })
            return 1
        }
    }

    private async resolveEvent(): Promise<SerializedEvent> {
        const rawStdin = this.stdinBuffer.trim()
        if (rawStdin) {
            return JSON.parse(rawStdin) as SerializedEvent
        }

        const runId = this.env.TERSE_RUN_ID ?? process.env.TERSE_RUN_ID
        if (!runId) {
            throw new Error("TERSE_RUN_ID is required when no event is provided on stdin")
        }

        const runRecord = await db().run_history_records.findUnique({
            where: { id: runId },
            select: { trigger_payload: true }
        })
        const event = parseSerializedTriggerPayload(runRecord?.trigger_payload ?? null)
        if (!event) {
            throw new Error(`Trigger event not available for run ${runId}`)
        }

        return event
    }

    private async withProcessState<T>(packageRoot: string, fn: () => Promise<T>): Promise<T> {
        const previousCwd = process.cwd()
        const previousEnv = new Map<string, string | undefined>()
        const mergedEnv = {
            TERSE_BACKEND_URL: settings.urls.backend,
            ...this.env
        }

        for (const [key, value] of Object.entries(mergedEnv)) {
            previousEnv.set(key, process.env[key])
            process.env[key] = value
        }

        const envPath = path.join(packageRoot, ".env")
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath })
        }

        process.chdir(packageRoot)
        try {
            return await fn()
        } finally {
            process.chdir(previousCwd)
            for (const [key, value] of previousEnv) {
                if (value === undefined) {
                    delete process.env[key]
                } else {
                    process.env[key] = value
                }
            }
        }
    }

    private async captureConsoleOutput<T>(fn: () => Promise<T>): Promise<T> {
        const original = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error
        }
        console.log = console.info = (...args: unknown[]) => {
            this.stdoutBuffer += `${formatConsoleArgs(args)}\n`
        }
        console.warn = console.error = (...args: unknown[]) => {
            this.stderrBuffer += `${formatConsoleArgs(args)}\n`
        }

        try {
            return await fn()
        } finally {
            console.log = original.log
            console.info = original.info
            console.warn = original.warn
            console.error = original.error
        }
    }
}

function resolveLocalSdkPackagePath(): string {
    const configured = process.env.LOCAL_SDK_PACKAGE_PATH ?? process.env.TERSE_LOCAL_SDK_PACKAGE_PATH
    if (!configured) {
        throw new Error("LOCAL_SDK_PACKAGE_PATH must point to the user's SDK package when using the in-memory sandbox")
    }

    const packageRoot = path.resolve(configured)
    if (!fs.existsSync(path.join(packageRoot, "package.json"))) {
        throw new Error(`LOCAL_SDK_PACKAGE_PATH does not contain package.json: ${packageRoot}`)
    }

    return packageRoot
}

function resolveLocalEntryPath(packageRoot: string): string {
    const configured = process.env.LOCAL_SDK_ENTRY_FILE ?? process.env.TERSE_LOCAL_SDK_ENTRY_FILE
    const entryFile = configured ?? DEFAULT_ENTRY_FILES.find(candidate => fs.existsSync(path.join(packageRoot, candidate)))
    if (!entryFile) {
        throw new Error(`Could not find a Terse entry file in ${packageRoot}`)
    }

    const entryPath = path.resolve(packageRoot, entryFile)
    if (!fs.existsSync(entryPath)) {
        throw new Error(`Terse entry file does not exist: ${entryPath}`)
    }

    return entryPath
}

async function loadLocalTerseSdk(packageRoot: string): Promise<LocalTerseSdk> {
    const requireFromPackage = createRequire(path.join(packageRoot, "package.json"))
    const sdkPath = requireFromPackage.resolve("terse-sdk")
    return import(pathToFileURL(sdkPath).href) as Promise<LocalTerseSdk>
}

async function loadTsxApi(packageRoot: string): Promise<{ tsImport: (path: string, parentURL: string) => Promise<unknown> }> {
    const requireFromPackage = createRequire(path.join(packageRoot, "package.json"))
    try {
        const tsxPath = requireFromPackage.resolve("tsx/esm/api")
        return import(pathToFileURL(tsxPath).href) as Promise<{ tsImport: (path: string, parentURL: string) => Promise<unknown> }>
    } catch {
        return import("tsx/esm/api") as Promise<{ tsImport: (path: string, parentURL: string) => Promise<unknown> }>
    }
}

function unquoteShellToken(value: string): string {
    if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1).replace(/'\\''/g, "'")
    }
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1)
    }
    return value
}

function formatConsoleArgs(args: unknown[]): string {
    return args.map(arg => (typeof arg === "string" ? arg : inspect(arg, { colors: false, depth: null }))).join(" ")
}

function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.stack ?? error.message
    }
    return String(error)
}

// Helper classes. For in-memory, most is a no-op
class InMemoryReader implements ReadableStreamDefaultReader<string> {
    readonly closed = Promise.resolve(undefined)
    private emitted = false

    constructor(private readonly fetchContent: () => Promise<string>) {}

    async read(): Promise<ReadableStreamReadResult<string>> {
        if (this.emitted) return { value: undefined, done: true }
        this.emitted = true
        return { value: await this.fetchContent(), done: false }
    }

    async cancel(): Promise<void> {
        this.emitted = true
    }

    releaseLock(): void {
        // No-op — in-memory reader holds no real lock.
    }
}

class NoOpFile implements SandboxFile {
    async read(): Promise<Uint8Array> {
        return new Uint8Array()
    }
    async write(_data: Uint8Array): Promise<void> {
        // No-op — image-build file writes are meaningless in in-memory mode.
    }
    async flush(): Promise<void> {
        // No-op
    }
    async close(): Promise<void> {
        // No-op
    }
}

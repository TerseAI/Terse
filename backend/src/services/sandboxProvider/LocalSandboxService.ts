import { ChildProcess, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import fs, { FileHandle } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

import logger from "../../common/logger"

import { ContainerProcess, ReadStream, Sandbox, SandboxApp, SandboxCreateParams, SandboxFile, SandboxImage, SandboxService, SandboxVolume, WriteStream } from "./SandboxService"
import { clearPidFile, recordChildPid, registerSandbox, sweepOrphanedSandboxProcesses, unregisterSandbox } from "./localSandboxLifecycle"
import { LOCAL_VOLUMES_DIR } from "../volumeStore/LocalVolumeStore"

const SANDBOX_ROOT = "/data/sandbox"
const IMAGES_DIR = path.join(SANDBOX_ROOT, "images")
const SANDBOXES_DIR = path.join(SANDBOX_ROOT, "sandboxes")
const FAKE_APP_ID = "local-app"
// "Registry images" don't exist locally — we just mark them as a fresh starting point.
const REGISTRY_IMAGE_MARKER = "__registry__"

/**
 * Local sandbox provider for self-host. Each sandbox is a working directory on
 * disk; each `exec` is a real subprocess via `child_process.spawn` with that
 * directory as its CWD.
 *
 * Layout under `/data/sandbox/` (same persistent volume as the SQLite DB):
 *   images/<imageId>/        — snapshotted filesystem states (deploy artifacts)
 *   sandboxes/<sandboxId>/   — active working directories
 *     scratch/                 — per-sandbox area for intermediate artifacts (zips, etc)
 *
 * Lifecycle mirrors Modal exactly so SdkSandboxImageService + SdkJobExecutionService
 * work unchanged: `terse deploy` → build dir → install deps → snapshot → image.
 * Runs use the snapshot, not the user's live source tree, so edits stay isolated
 * until the next deploy.
 *
 * `supportsContainerizedRunners` is false — subprocess isolation only, no
 * container/filesystem isolation. Self-host is single-tenant by design (see
 * SELF_HOSTING.md).
 */
export class LocalSandboxService implements SandboxService<SandboxImage, LocalSandbox, LocalSandboxVolume> {
    readonly supportsContainerizedRunners = false

    constructor() {
        // Kill any child processes left alive by a previous backend run before
        // we hand out new sandboxes. Fire-and-forget; we don't want to block
        // provider construction on filesystem I/O.
        void sweepOrphanedSandboxProcesses(SANDBOXES_DIR)
    }

    async getOrCreateApp(name: string): Promise<SandboxApp> {
        logger.info("#LocalSandbox app ready", { app: name })
        return { appId: FAKE_APP_ID, name }
    }

    async getOrCreateVolume(name: string): Promise<LocalSandboxVolume> {
        const volumePath = path.join(LOCAL_VOLUMES_DIR, name)
        await fs.mkdir(volumePath, { recursive: true })
        logger.info("#LocalSandbox volume ready", { volume: name, volumePath })
        return { volumeId: name, name, rootPath: volumePath }
    }

    async deleteVolume(volumeId: string): Promise<void> {
        const volumePath = path.join(LOCAL_VOLUMES_DIR, volumeId)
        await fs.rm(volumePath, { recursive: true, force: true })
        logger.info("#LocalSandbox volume deleted", { volumeId, volumePath })
    }

    async deleteVolumePath(volumeName: string, relativePath: string): Promise<void> {
        const target = path.join(LOCAL_VOLUMES_DIR, volumeName, relativePath)
        await fs.rm(target, { recursive: true, force: true })
        logger.info("#LocalSandbox volume path deleted", { volume: volumeName, target })
    }

    getImageFromRegistry(_registry: string): SandboxImage {
        logger.info("#LocalSandbox image registry marker (fresh starting point)")
        return { imageId: REGISTRY_IMAGE_MARKER }
    }

    async getImageFromId(imageId: string): Promise<SandboxImage> {
        logger.info("#LocalSandbox image fromId", { imageId })
        return { imageId }
    }

    async imageExists(imageId: string): Promise<boolean> {
        if (imageId === REGISTRY_IMAGE_MARKER) return true
        return existsSync(path.join(IMAGES_DIR, imageId))
    }

    async deleteImage(imageId: string): Promise<void> {
        if (imageId === REGISTRY_IMAGE_MARKER) return
        const t0 = Date.now()
        await fs.rm(path.join(IMAGES_DIR, imageId), { recursive: true, force: true })
        logger.info("#LocalSandbox image deleted", { imageId, durationMs: Date.now() - t0 })
    }

    getProjectPath(sandbox: LocalSandbox): string {
        return path.join(sandbox.workingDir, "project")
    }

    getDependencyCachePath(sandbox: LocalSandbox, runtime: string): string {
        return path.join(sandbox.workingDir, "cache", runtime, "project")
    }

    getCliCachePath(sandbox: LocalSandbox): string {
        return path.join(sandbox.workingDir, "cache", "cli")
    }

    getScratchPath(sandbox: LocalSandbox, filename: string): string {
        return path.join(sandbox.workingDir, "scratch", filename)
    }

    async getOrCreateSandbox(_app: SandboxApp, image: SandboxImage, uniqueName: string, params?: SandboxCreateParams): Promise<LocalSandbox> {
        const t0 = Date.now()
        logger.info("#LocalSandbox getOrCreate begin", { uniqueName, imageId: image.imageId })
        const workingDir = path.join(SANDBOXES_DIR, uniqueName)
        await fs.rm(workingDir, { recursive: true, force: true })
        await fs.mkdir(workingDir, { recursive: true })

        if (image.imageId !== REGISTRY_IMAGE_MARKER) {
            const imagePath = path.join(IMAGES_DIR, image.imageId)
            if (!existsSync(imagePath)) {
                const err = new Error(`#LocalSandbox image ${image.imageId} not found at ${imagePath}.`) as Error & { code?: string }
                err.code = "SANDBOX_IMAGE_MISSING"
                throw err
            }
            await fs.cp(imagePath, workingDir, { recursive: true })
        }

        if (params?.volumes) {
            for (const [mountPath, volumeRef] of Object.entries(params.volumes)) {
                const localVolume = volumeRef as LocalSandboxVolume
                const relativeMount = mountPath.replace(/^\/+/, "")
                const mountPoint = path.join(workingDir, relativeMount)
                await fs.mkdir(path.dirname(mountPoint), { recursive: true })
                await fs.rm(mountPoint, { recursive: true, force: true })
                await fs.symlink(localVolume.rootPath, mountPoint)
            }
        }

        logger.info("#LocalSandbox created", { uniqueName, workingDir, durationMs: Date.now() - t0 })
        return new LocalSandbox(uniqueName, workingDir)
    }

    // Self-host does not reach back into running sandboxes; memory/FS resolves via the
    // backend LocalVolumeStore fallback instead.
    async findLiveSandbox(_uniqueName: string): Promise<LocalSandbox | null> {
        return null
    }
}

// ─────────────── helpers (bottom) ───────────────

export interface LocalSandboxVolume extends SandboxVolume {
    name: string
    rootPath: string
}

export class LocalSandbox implements Sandbox {
    private readonly children = new Set<ChildProcess>()

    constructor(
        readonly sandboxId: string,
        readonly workingDir: string
    ) {
        registerSandbox(this)
    }

    async exec(command: string[], params?: { env?: Record<string, string> }): Promise<ContainerProcess> {
        const [cmd, ...args] = command
        const child = spawn(cmd, args, {
            cwd: this.workingDir,
            env: { ...process.env, ...params?.env },
            stdio: ["pipe", "pipe", "pipe"]
        })
        this.children.add(child)
        void recordChildPid(this.workingDir, child)
        return new ChildContainerProcess(child, () => this.children.delete(child))
    }

    async open(filePath: string, mode: "r" | "w"): Promise<SandboxFile> {
        // Absolute paths (e.g. /tmp/foo) pass through as-is so they match what
        // shell commands see. Relative paths resolve under workingDir.
        const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workingDir, filePath)
        if (mode === "w") {
            await fs.mkdir(path.dirname(fullPath), { recursive: true })
        }
        return new LocalFile(fullPath, mode)
    }

    async terminate(): Promise<void> {
        logger.info("#LocalSandbox terminate", { sandboxId: this.sandboxId, childCount: this.children.size })
        for (const child of this.children) {
            child.kill("SIGTERM")
        }
        this.children.clear()
        unregisterSandbox(this)
        await clearPidFile(this.workingDir).catch(() => {})
    }

    async snapshotFilesystem(): Promise<{ imageId: string }> {
        const t0 = Date.now()
        const imageId = `local-${randomUUID()}`
        const imagePath = path.join(IMAGES_DIR, imageId)
        await fs.mkdir(IMAGES_DIR, { recursive: true })
        await fs.cp(this.workingDir, imagePath, { recursive: true })
        logger.info("#LocalSandbox snapshot", { sandboxId: this.sandboxId, imageId, durationMs: Date.now() - t0 })
        return { imageId }
    }
}

class ChildContainerProcess implements ContainerProcess {
    private exitPromise: Promise<number> | null = null

    constructor(
        private readonly child: ChildProcess,
        private readonly onExit: () => void
    ) {}

    get stdin(): WriteStream {
        const child = this.child
        return {
            writeText: async (text: string) => {
                if (!child.stdin) throw new Error("stdin not available")
                await new Promise<void>((resolve, reject) => child.stdin!.write(text, err => (err ? reject(err) : resolve())))
            },
            writeBytes: async (bytes: Uint8Array) => {
                if (!child.stdin) throw new Error("stdin not available")
                await new Promise<void>((resolve, reject) => child.stdin!.write(Buffer.from(bytes), err => (err ? reject(err) : resolve())))
            }
        }
    }

    get stdout(): ReadStream<string> {
        return wrapNodeReadable(this.child.stdout)
    }

    get stderr(): ReadStream<string> {
        return wrapNodeReadable(this.child.stderr)
    }

    async wait(): Promise<number> {
        if (!this.exitPromise) {
            this.exitPromise = new Promise(resolve => {
                this.child.on("exit", code => {
                    this.onExit()
                    resolve(code ?? 1)
                })
            })
        }
        return this.exitPromise
    }
}

function wrapNodeReadable(stream: Readable | null): ReadStream<string> {
    if (!stream) {
        return {
            readText: async () => "",
            readBytes: async () => new Uint8Array(),
            getReader: () => emptyReader()
        }
    }

    return {
        readText: async () =>
            new Promise<string>((resolve, reject) => {
                const chunks: string[] = []
                stream.on("data", chunk => chunks.push(chunk instanceof Buffer ? chunk.toString("utf8") : String(chunk)))
                stream.on("end", () => resolve(chunks.join("")))
                stream.on("error", reject)
            }),
        readBytes: async () =>
            new Promise<Uint8Array>((resolve, reject) => {
                const chunks: Buffer[] = []
                stream.on("data", chunk => chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk)))
                stream.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))))
                stream.on("error", reject)
            }),
        getReader: () => createNodeStreamReader(stream)
    }
}

function createNodeStreamReader(stream: Readable): ReadableStreamDefaultReader<string> {
    const queued: string[] = []
    let ended = false
    let errored: Error | null = null
    let pendingResolve: ((result: ReadableStreamReadResult<string>) => void) | null = null
    let pendingReject: ((reason: unknown) => void) | null = null
    let resolveClosed!: (value: undefined) => void
    const closed = new Promise<undefined>(resolve => {
        resolveClosed = resolve
    })

    stream.on("data", chunk => {
        const text = chunk instanceof Buffer ? chunk.toString("utf8") : String(chunk)
        if (pendingResolve) {
            const resolve = pendingResolve
            pendingResolve = null
            pendingReject = null
            resolve({ value: text, done: false })
        } else {
            queued.push(text)
        }
    })
    stream.on("end", () => {
        ended = true
        if (pendingResolve) {
            const resolve = pendingResolve
            pendingResolve = null
            pendingReject = null
            resolve({ value: undefined, done: true })
        }
        resolveClosed(undefined)
    })
    stream.on("error", err => {
        errored = err
        if (pendingReject) {
            const reject = pendingReject
            pendingResolve = null
            pendingReject = null
            reject(err)
        }
        resolveClosed(undefined)
    })

    return {
        closed,
        async read(): Promise<ReadableStreamReadResult<string>> {
            if (errored) throw errored
            if (queued.length > 0) return { value: queued.shift()!, done: false }
            if (ended) return { value: undefined, done: true }
            return new Promise((resolve, reject) => {
                pendingResolve = resolve
                pendingReject = reject
            })
        },
        async cancel() {
            stream.destroy()
        },
        releaseLock() {
            // No-op — we don't enforce single-reader semantics on this lightweight wrapper.
        }
    }
}

function emptyReader(): ReadableStreamDefaultReader<string> {
    return {
        closed: Promise.resolve(undefined),
        read: async () => ({ value: undefined, done: true }),
        cancel: async () => {},
        releaseLock: () => {}
    }
}

class LocalFile implements SandboxFile {
    private handle: FileHandle | null = null

    constructor(
        private readonly fullPath: string,
        private readonly mode: "r" | "w"
    ) {}

    private async ensureOpen(): Promise<FileHandle> {
        if (!this.handle) {
            this.handle = await fs.open(this.fullPath, this.mode === "w" ? "w" : "r")
        }
        return this.handle
    }

    async read(): Promise<Uint8Array> {
        const h = await this.ensureOpen()
        const { size } = await h.stat()
        const buffer = Buffer.alloc(size)
        await h.read(buffer, 0, size, 0)
        return new Uint8Array(buffer)
    }

    async write(data: Uint8Array): Promise<void> {
        const h = await this.ensureOpen()
        await h.write(data, 0, data.byteLength)
    }

    async flush(): Promise<void> {
        await this.handle?.sync()
    }

    async close(): Promise<void> {
        await this.handle?.close()
        this.handle = null
    }
}

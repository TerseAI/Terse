export interface SandboxService<I extends SandboxImage = SandboxImage, S extends Sandbox = Sandbox> {
    // True when the provider runs jobs in isolated containers (Modal/Docker/etc). False for in-memory.
    readonly supportsContainerizedRunners: boolean

    getOrCreateApp(name: string): Promise<SandboxApp>

    getImageFromRegistry(registry: string): I
    getImageFromId(imageId: string): Promise<I>
    deleteImage(imageId: string): Promise<void>

    imageExists(imageId: string): Promise<boolean>

    getOrCreateSandbox(app: SandboxApp, image: I, uniqueName: string, params?: SandboxCreateParams): Promise<S>

    // Best-effort: terminate a sandbox by its unique name if one is live. No-op if absent.
    terminateSandbox(app: SandboxApp, uniqueName: string): Promise<void>

    // Return a live sandbox by its unique name, or null if none is live. Does not create.
    getExistingSandbox(app: SandboxApp, uniqueName: string): Promise<S | null>

    // Per-project persistent volume (Modal Volume v2 / local dir). Always created for executing sandboxes.
    getOrCreateProjectVolume(projectId: string): Promise<SandboxVolume>
    deleteProjectVolume(projectId: string): Promise<void>
    // Filesystem rooted at the project volume. On Modal, when runId names a live runtime sandbox this
    // attaches to it and operates on the mounted volume (committing via `sync`); otherwise it mounts the
    // volume on a throwaway sandbox. Locally it is direct disk IO.
    getProjectVolumeFs(projectId: string, runId?: string): Promise<VolumeFs>

    // Isolated per-project volume for `terse test` memory (mem-test-<projectId>), separate from the
    // production volume above. The fs always uses a throwaway sandbox / direct disk IO; it never attaches
    // to a live runtime sandbox (those mount the production volume).
    getOrCreateTestProjectVolume(projectId: string): Promise<SandboxVolume>
    deleteTestProjectVolume(projectId: string): Promise<void>
    getTestProjectVolumeFs(projectId: string): Promise<VolumeFs>

    getProjectPath(sandbox: S): string
    getDependencyCachePath(sandbox: S, runtime: string): string
    getCliCachePath(sandbox: S): string
    getScratchPath(sandbox: S, filename: string): string
}

export interface SandboxApp {
    appId: string
    name?: string
}

export interface SandboxImage {
    imageId: string
}

export interface Sandbox {
    sandboxId: string
    exec(command: string[], params?: SandboxExecParams): Promise<ContainerProcess>
    open(path: string, mode: "r" | "w"): Promise<SandboxFile>
    terminate(): Promise<void>
    snapshotFilesystem(): Promise<SandboxFileSystemSnapshot>
}

export interface ReadStream<R = string> {
    readText(): Promise<string>
    readBytes(): Promise<Uint8Array>
    getReader(): ReadableStreamDefaultReader<R>
}

export interface WriteStream {
    writeText(text: string): Promise<void>
    writeBytes(bytes: Uint8Array): Promise<void>
}

export interface ContainerProcess {
    get stdin(): WriteStream
    get stdout(): ReadStream<string>
    get stderr(): ReadStream<string>
    wait(): Promise<number>
}

type SandboxExecParams = {
    /** Specifies text or binary encoding for input and output streams. */
    mode?: StreamMode
    /** Whether to pipe or ignore standard output. */
    stdout?: StdioBehavior
    /** Whether to pipe or ignore standard error. */
    stderr?: StdioBehavior
    /** Working directory to run the command in. */
    workdir?: string
    /** Timeout for the process in milliseconds. Defaults to 0 (no timeout). */
    timeoutMs?: number
    /** Environment variables to set for the command. */
    env?: Record<string, string>
    /** {@link Secret}s to inject as environment variables for the commmand.*/
    secrets?: Secret[]
    /** Enable a PTY for the command. */
    pty?: boolean
}

type SandboxCreateParams = {
    timeoutMs?: number
    idleTimeoutMs?: number
    blockNetwork?: boolean
    cidrAllowlist?: string[]
    proxy?: SandboxProxy
    secrets?: Secret[]
    /** Mount points (absolute path -> volume handle from getOrCreateProjectVolume). */
    volumes?: Record<string, SandboxVolume>
}

/** Opaque per-provider volume handle (Modal Volume / local dir marker). */
export type SandboxVolume = unknown

export interface VolumeDirEntry {
    name: string
    isDirectory: boolean
    sizeBytes: number
}

/**
 * Filesystem rooted at a project volume. All paths are relative to the volume root.
 * Mutations are only durable after sync() (Modal Volumes v2 commit; no-op locally).
 */
export interface VolumeFs {
    list(dirPath: string): Promise<VolumeDirEntry[]>
    read(filePath: string): Promise<string | null>
    write(filePath: string, content: string): Promise<void>
    stat(path: string): Promise<{ isDirectory: boolean; sizeBytes: number } | null>
    remove(path: string): Promise<void>
    rename(fromPath: string, toPath: string): Promise<void>
    mkdirp(dirPath: string): Promise<void>
    sync(): Promise<void>
    /** Release any resources (e.g. an ephemeral sandbox spun up to reach the volume). No-op when attached to a live sandbox. */
    dispose(): Promise<void>
}

interface SandboxProxy {
    proxyId?: string
}

interface Secret {
    secretId: string
    name?: string
}

type StdioBehavior = "pipe" | "ignore"
type StreamMode = "text" | "binary"

export interface SandboxFile {
    read(): Promise<Uint8Array>
    write(data: Uint8Array): Promise<void>
    flush(): Promise<void>
    close(): Promise<void>
}

interface SandboxFileSystemSnapshot {
    imageId: string
}

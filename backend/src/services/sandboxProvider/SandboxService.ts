export interface SandboxService<I extends SandboxImage = SandboxImage, S extends Sandbox = Sandbox, V extends SandboxVolume = SandboxVolume> {
    // True when the provider runs jobs in isolated containers (Modal/Docker/etc). False for in-memory.
    readonly supportsContainerizedRunners: boolean

    getOrCreateApp(name: string): Promise<SandboxApp>
    getOrCreateVolume(name: string): Promise<V>
    deleteVolume(volumeId: string): Promise<void>

    getImageFromRegistry(registry: string): I
    getImageFromId(imageId: string): Promise<I>
    deleteImage(imageId: string): Promise<void>

    imageExists(imageId: string): Promise<boolean>

    getOrCreateSandbox(app: SandboxApp, image: I, uniqueName: string, params?: SandboxCreateParams): Promise<S>

    /** Look up an already-running sandbox by its unique name without creating one. Returns null if none is live. */
    findLiveSandbox(uniqueName: string): Promise<S | null>

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

export interface SandboxVolume {
    volumeId: string
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

export type SandboxCreateParams = {
    timeoutMs?: number
    idleTimeoutMs?: number
    blockNetwork?: boolean
    cidrAllowlist?: string[]
    proxy?: SandboxProxy
    secrets?: Secret[]
    /** Mount paths mapped to persistent sandbox volumes. */
    volumes?: Record<string, SandboxVolume>
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

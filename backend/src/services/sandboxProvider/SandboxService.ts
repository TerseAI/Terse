export interface SandboxService<I extends SandboxImage = SandboxImage, S extends Sandbox = Sandbox, A extends SandboxApp = SandboxApp> {
    // True when the provider runs jobs in isolated containers (Modal/Docker/etc). False for in-memory.
    readonly supportsContainerizedRunners: boolean

    getOrCreateApp(name: string): Promise<A>

    getImageFromRegistry(registry: string): I
    getImageFromId(imageId: string): Promise<I>

    createBucketMount(params: BucketMountParams): Promise<SandboxBucketMount | undefined>

    deleteImage(imageId: string): Promise<void>

    imageExists(imageId: string): Promise<boolean>

    getOrCreateSandbox(app: A, image: I, uniqueName: string, params?: SandboxCreateParams): Promise<S>

    // Best-effort: terminate a sandbox by its unique name if one is live. No-op if absent.
    terminateSandbox(app: A, uniqueName: string): Promise<void>

    // Return a live sandbox by its unique name, or null if none is live. Does not create.
    getExistingSandbox(app: A, uniqueName: string): Promise<S | null>

    getProjectPath(sandbox: S): string
    getCliCachePath(sandbox: S): string
    getScratchPath(sandbox: S, filename: string): string

    /** Compatibility-only filesystem snapshot for deprecated on-disk workflow journals. */
    snapshotForSuspension(sandbox: S): Promise<string>
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
    outboundCidrAllowlist?: string[]
    proxy?: SandboxProxy
    secrets?: Secret[]
    /** Mount points (absolute path -> volume handle from a VolumeManager). */
    volumes?: Record<string, SandboxVolume>
    cloudBucketMounts?: Record<string, SandboxBucketMount>
    /** Provider-level placement constraints. Omit for unpinned legacy and local runs. */
    regions?: string[]
    /** Enable Modal private IPv6 networking for directly connected regional runtimes. */
    i6pn?: boolean
}

/** Opaque per-provider volume handle (Modal Volume / local dir marker). */
export type SandboxVolume = unknown

/** Opaque per-provider bucket mount handle. */
export type SandboxBucketMount = unknown

export interface BucketMountParams {
    bucket: string
    /** Scopes what the sandbox can see. Customer code runs in there, so this is not optional. */
    keyPrefix: string
    accessKeyId: string
    secretAccessKey: string
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

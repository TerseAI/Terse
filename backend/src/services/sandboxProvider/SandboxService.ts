export interface SandboxService<I extends SandboxImage = SandboxImage> {
    /**
     * Mark: App related API
     */
    getOrCreateApp(name: string): Promise<SandboxApp>
    /**
     * Mark: Image related API
     */
    getImageFromRegistry(registry: string): I
    getImageFromId(imageId: string): Promise<I>
    deleteImage(imageId: string): Promise<void>

    /**
     * Mark: Sandbox related API
     */
    getOrCreateSandbox(app: SandboxApp, image: I, uniqueName: string, params?: SandboxCreateParams): Promise<Sandbox>
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

interface ReadStream<R = any> extends ReadableStream<R> {
    readText(): Promise<string>
    readBytes(): Promise<Uint8Array>
}

interface WriteStream<R = any> extends WritableStream<R> {
    writeText(text: string): Promise<void>
    writeBytes(bytes: Uint8Array): Promise<void>
}

interface ContainerProcess {
    get stdin(): WriteStream<string>
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

interface SandboxFile {
    read(): Promise<Uint8Array>
    write(data: Uint8Array): Promise<void>
    flush(): Promise<void>
    close(): Promise<void>
}

interface SandboxFileSystemSnapshot {
    imageId: string
}

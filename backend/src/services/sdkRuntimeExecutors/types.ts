export type SdkProjectRuntime = "typescript" | "python"

export interface SandboxCommandResult {
    exitCode: number
    stdout: string
    stderr: string
}

export interface SdkRuntimeExecutorContext {
    sb: any
    sandboxEnv: Record<string, string>
    runId: string
    agentId: string
    jobName: string
    projectDir: string
    eventFilePath: string
    ensureSandboxCommand: (label: string, command: string) => Promise<void>
    runSandboxCommand: (label: string, command: string) => Promise<SandboxCommandResult>
    escapeShellArg: (value: string) => string
}

export interface SdkRuntimeExecutor {
    runtime: SdkProjectRuntime
    sandboxImage: string
    detectionEntries: readonly string[]
    matchesArchive(entries: Set<string>): boolean
    execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult>
}

export const SDK_SANDBOX_CODE_ZIP_PATH = "/tmp/code.zip"
export const SDK_SANDBOX_PROJECT_DIR = "/tmp/project"
export const SDK_SANDBOX_EVENT_FILE_PATH = "/tmp/event.json"

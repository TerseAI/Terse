import type { LocalPackagesBundle } from "../../utility/localPackages"
import type { Sandbox } from "../sandboxProvider/SandboxService"

export type SdkProjectRuntime = "typescript"

export interface SandboxCommandResult {
    exitCode: number
    stdout: string
    stderr: string
}

export interface SdkProjectArchive {
    entries: Set<string>
    has(path: string): boolean
    readText(path: string): string | null
}

export interface SdkDependencyImageDefinition {
    dependencyHash: string
}

export interface SdkDependencyImageBuildContext {
    sb: Sandbox
    archive: SdkProjectArchive
    cliVersion: string
    templateDir: string
    cliCachePath: string
    // Dev-only: locally-packed terse-types/terse-sdk/terse-cli to install instead of npm registry versions.
    localPackages?: LocalPackagesBundle
    ensureSandboxCommand: (label: string, command: string) => Promise<void>
    writeFile: (path: string, content: string) => Promise<void>
    writeBinaryFile: (path: string, content: Buffer) => Promise<void>
    escapeShellArg: (value: string) => string
}

export interface SdkSourceImageBuildContext {
    sb: Sandbox
    projectDir: string
    templateDir: string
    ensureSandboxCommand: (label: string, command: string) => Promise<void>
    escapeShellArg: (value: string) => string
}

export interface SdkRuntimeExecutorContext {
    sb: Sandbox
    sandboxEnv: Record<string, string>
    runId: string
    agentId: string
    jobName: string
    projectDir: string
    cliCachePath: string
    usesPrebuiltImage: boolean
    cliVersion: string
    ensureSandboxCommand: (label: string, command: string) => Promise<void>
    runSandboxCommand: (label: string, command: string) => Promise<SandboxCommandResult>
    runSandboxCommandStreaming: (label: string, command: string) => Promise<SandboxCommandResult>
    escapeShellArg: (value: string) => string
}

export interface SdkRuntimeExecutor {
    runtime: SdkProjectRuntime
    sandboxImage: string
    matchesArchive(entries: Set<string>): boolean
    defineDependencyImage(archive: SdkProjectArchive, cliVersion: string, localPackages?: LocalPackagesBundle): SdkDependencyImageDefinition
    buildDependencyImage(context: SdkDependencyImageBuildContext): Promise<void>
    prepareSourceImage(context: SdkSourceImageBuildContext): Promise<void>
    execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult>
    resume(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult>
}

export const SDK_SOURCE_IMAGE_PROJECT_DIR = "/opt/terse-sdk-run/project"

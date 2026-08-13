import type { LocalPackagesBundle } from "../../utility/localPackages"
import type { ResolvedSandboxBaseImage } from "../sandboxBaseImage/SandboxBaseImageResolver"
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

export interface SdkDeployImageDefinition {
    buildHash: string
}

export interface SdkDeployImageBuildContext {
    sb: Sandbox
    archive: SdkProjectArchive
    cliVersion: string
    baseImage: ResolvedSandboxBaseImage
    projectDir: string
    cliCachePath: string
    /** Package-manager cache locations, backed by the org's cache volume when one is mounted. */
    packageCache: PackageCachePaths
    // Dev-only: locally-packed terse-types/terse-sdk/terse-cli to install instead of npm registry versions.
    localPackages?: LocalPackagesBundle
    ensureSandboxCommand: (label: string, command: string) => Promise<void>
    writeFile: (path: string, content: string) => Promise<void>
    writeBinaryFile: (path: string, content: Buffer) => Promise<void>
    escapeShellArg: (value: string) => string
}

export interface PackageCachePaths {
    /** Mounted per-organization cache, or undefined when the provider has no volumes. */
    npmCacheDir?: string
    pnpmStoreDir?: string
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
    /** Base image used when no released sandbox image matches the deploy. */
    sandboxImage: string
    /** Artifact Registry repository name of this runtime's prebuilt sandbox image. */
    releaseImageName: string
    matchesArchive(entries: Set<string>): boolean
    defineDeployImage(params: DefineDeployImageParams): SdkDeployImageDefinition
    buildDeployImage(context: SdkDeployImageBuildContext): Promise<void>
    execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult>
    resume(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult>
}

export interface DefineDeployImageParams {
    archive: SdkProjectArchive
    organizationId: string
    sourceHash: string
    cliVersion: string
    baseImage: ResolvedSandboxBaseImage
    localPackages?: LocalPackagesBundle
}

export const SDK_SOURCE_IMAGE_PROJECT_DIR = "/opt/terse-sdk-run/project"

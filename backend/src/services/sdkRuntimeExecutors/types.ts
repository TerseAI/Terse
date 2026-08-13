import type { LocalPackagesBundle } from "../../utility/localPackages"
import type { ResolvedSandboxBaseImage } from "../sandboxBaseImage/SandboxBaseImageResolver"
import type { Sandbox } from "../sandboxProvider/SandboxService"

export type SdkProjectRuntime = "typescript"

export type SdkDeployPhase = "preparing" | "reusing_cached_build" | "starting_sandbox" | "uploading_source" | "building_project" | "saving_image"

/** The subset a runtime executor is responsible for. */
export type SdkBuildStep = Extract<SdkDeployPhase, "building_project">

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
    requiresWorkflowBundle: boolean
    projectDir: string
    cliCachePath: string
    unpackCommand: string
    localPackages?: LocalPackagesBundle
    ensureSandboxCommand: (step: SdkBuildStep, command: string) => Promise<void>
    writeFile: (path: string, content: string) => Promise<void>
    writeBinaryFile: (path: string, content: Buffer) => Promise<void>
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
    releaseImageNameFor(archive: SdkProjectArchive): string
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

import { SandboxStage } from "terse-types"

import { extractErrorMessage } from "../../utility/strings"
import type { Sandbox } from "../sandboxProvider/SandboxService"

export { SandboxStage }

export type SdkProjectRuntime = "typescript" | "python"

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
    templateDir: string
    ensureSandboxCommand: (label: string, command: string) => Promise<void>
    writeFile: (path: string, content: string) => Promise<void>
    escapeShellArg: (value: string) => string
}

export interface SdkSourceImageBuildContext {
    sb: Sandbox
    projectDir: string
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
    usesPrebuiltImage: boolean
    ensureSandboxCommand: (label: string, command: string) => Promise<void>
    runSandboxCommand: (label: string, command: string) => Promise<SandboxCommandResult>
    runSandboxCommandStreaming: (label: string, command: string) => Promise<SandboxCommandResult>
    escapeShellArg: (value: string) => string
    emitSandboxStatus: (stage: SandboxStage, status: "started" | "completed" | "failed", opts?: { duration_ms?: number; detail?: string }) => void
}

export interface SdkRuntimeExecutor {
    runtime: SdkProjectRuntime
    sandboxImage: string
    matchesArchive(entries: Set<string>): boolean
    defineDependencyImage(archive: SdkProjectArchive): SdkDependencyImageDefinition
    buildDependencyImage(context: SdkDependencyImageBuildContext): Promise<void>
    prepareSourceImage(context: SdkSourceImageBuildContext): Promise<void>
    execute(context: SdkRuntimeExecutorContext): Promise<SandboxCommandResult>
}

/**
 * Run a sandbox stage that should throw on failure (e.g. dependency/CLI install).
 * Emits started/completed/failed status and re-throws on error.
 */
export async function runSandboxStage(context: SdkRuntimeExecutorContext, stage: SandboxStage, fn: () => Promise<void>): Promise<void> {
    context.emitSandboxStatus(stage, "started")
    const start = performance.now()
    try {
        await fn()
        context.emitSandboxStatus(stage, "completed", { duration_ms: Math.round(performance.now() - start) })
    } catch (err) {
        context.emitSandboxStatus(stage, "failed", {
            duration_ms: Math.round(performance.now() - start),
            detail: extractErrorMessage(err)
        })
        throw err
    }
}

/**
 * Run the final execution stage. Emits started/completed/failed based on exit code (does not throw).
 */
export async function runSandboxExecStage(context: SdkRuntimeExecutorContext, fn: () => Promise<SandboxCommandResult>): Promise<SandboxCommandResult> {
    context.emitSandboxStatus(SandboxStage.RUNNING, "started")
    const start = performance.now()
    const result = await fn()
    if (result.exitCode === 0) {
        context.emitSandboxStatus(SandboxStage.RUNNING, "completed", { duration_ms: Math.round(performance.now() - start) })
    } else {
        const detail = result.stderr?.trim() || `Process exited with code ${result.exitCode}`
        context.emitSandboxStatus(SandboxStage.RUNNING, "failed", { duration_ms: Math.round(performance.now() - start), detail: detail.slice(0, 500) })
    }
    return result
}

export const SDK_SANDBOX_CODE_ZIP_PATH = "/tmp/code.zip"
export const SDK_SANDBOX_PROJECT_DIR = "/tmp/project"
export const SDK_SOURCE_IMAGE_PROJECT_DIR = "/opt/terse-sdk-run/project"
export const SDK_SOURCE_IMAGE_CODE_ZIP_PATH = "/tmp/source-image-code.zip"

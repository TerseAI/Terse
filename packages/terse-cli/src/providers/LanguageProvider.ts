import type { CreateJobParameters } from "terse-sdk"
import type { SerializedEvent, Trigger } from "terse-types"

import type { CodegenInput } from "./codegenTypes"

export interface LanguageProvider {
    readonly language: "typescript"
    readonly displayName: string
    readonly detectionMarkers: {
        requiredFiles: string[]
        description: string
    }
    readonly projectMarkers: {
        requiredFiles: string[]
        description: string
    }
    readonly entryFile: string
    readonly generatedCodePath: string
    readonly deployExclusions: {
        dirs: Set<string>
        files: Set<string>
    }

    scaffoldFiles(): Array<{ template: string; output: string }>
    buildInitTemplateContext(projectName: string, sdkVersion: string): Record<string, unknown>
    getPostInitSteps(packageManager: string): string[]
    detectPackageManager(): string
    installDependencies(targetDir: string): Promise<void>
    resolveGeneratedCodePath(cwd: string): string
    renderGeneratedFiles(input: CodegenInput): Promise<GeneratedFile[]>
    typecheck(): Promise<void>
    loadJobRegistry(entryFile?: string): Promise<Map<string, CreateJobParameters>>
    prebuild(): Promise<void>
    runtimeName(job: CreateJobParameters): "durable" | "direct"
    executeJob(
        job: CreateJobParameters,
        runId: string | null,
        event: SerializedEvent,
        opts?: {
            verbose?: boolean
            entryFile?: string
            projectId?: string
            /**
             * Wraps interactive prompts (e.g. tool-approval confirms) so the
             * caller can pause any outer UI it owns (clack spinners, etc.)
             * for the duration of the prompt and decision submission.
             */
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void>
    resumeRun(
        runId: string,
        opts?: {
            verbose?: boolean
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void>
    resumeRunWithInput(
        runId: string,
        input: { token: string; payload: unknown },
        opts?: {
            verbose?: boolean
            pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
        }
    ): Promise<void>
}

export type GeneratedFile = {
    readonly fileName: string
    readonly code: string
}

import type { CreateJobParameters } from "terse-sdk"
import type { SerializedEvent, Trigger } from "terse-types"

import type { CodegenInput } from "./codegenTypes"

export interface LanguageProvider {
    readonly language: "typescript" | "python"
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
    renderGeneratedCode(input: CodegenInput): string
    loadJobRegistry(entryFile?: string): Promise<Map<string, CreateJobParameters>>
    executeJob(job: CreateJobParameters, event: SerializedEvent, opts?: { verbose?: boolean; entryFile?: string }): Promise<void>
}

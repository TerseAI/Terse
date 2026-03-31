import type { CreateJobParameters } from "terse-sdk"
import type { CodegenInput } from "./codegenTypes.js"
import type { SerializedEvent } from "../shared/types.js"

export interface LanguageProvider {
    readonly language: "typescript" | "python"
    readonly displayName: string
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
    detectPackageManager(): string
    installDependencies(targetDir: string): Promise<void>
    renderGeneratedCode(input: CodegenInput): string
    loadJobRegistry(): Promise<Map<string, CreateJobParameters>>
    executeJob(
        job: CreateJobParameters,
        event: SerializedEvent,
        opts?: { verbose?: boolean }
    ): Promise<void>
}

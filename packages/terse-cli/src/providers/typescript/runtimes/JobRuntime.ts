import type { CreateJobParameters } from "terse-sdk"
import type { SerializedEvent } from "terse-types"

export type RunJobOptions = {
    verbose?: boolean
    entryFile?: string
    projectId?: string
    pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
}

export type ResumeRunOptions = {
    verbose?: boolean
    pauseUiAround?: <T>(fn: () => Promise<T>) => Promise<T>
}

export interface JobRuntime {
    executeJob(job: CreateJobParameters, runId: string | null, event: SerializedEvent, opts?: RunJobOptions): Promise<void>
    resumeRun(runId: string, opts?: ResumeRunOptions): Promise<void>
}

export function formatErrorDetail(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

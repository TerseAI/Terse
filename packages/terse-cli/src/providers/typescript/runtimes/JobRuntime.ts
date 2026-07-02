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
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    if (error && typeof error === "object") {
        return stringifyErrorObject(error)
    }
    return String(error)
}

function stringifyErrorObject(error: object): string {
    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

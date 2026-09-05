import type { ExecutionRegion } from "terse-types/ExecutionRegions"
import { SdkInputResponsePayload, UserSession } from "terse-types/types"

import { AgentWithRelations } from "../../types/prisma"

export type JobExecutionKind = "sandbox" | "remote-webhook"

export interface JobExecutionContext {
    readonly runId: string
    readonly agent: AgentWithRelations
    readonly orgId: string
    readonly userId: string
    readonly user: UserSession
    readonly jobName: string
    readonly executionMode: "start" | "resume"
    /** Snapshot image used only by deprecated filesystem-backed durable runs. */
    readonly restoreImageId?: string
    /** Input response to inject when resuming a run parked on a workflow hook. */
    readonly hookResume?: HookResume
    /** User-visible signal that caused a suspended run to resume. */
    readonly resumeSignal?: ResumeSignal
    readonly enqueuedAtMs?: number
    readonly scheduledForMs?: number
    /** Stable region pinned on the run record. Null for legacy and self-hosted runs. */
    readonly executionRegion: ExecutionRegion | null
}

export type HookResume = {
    readonly token: string
    readonly payload: SdkInputResponsePayload
}

export type ResumeSignal = {
    readonly kind: "timer" | "input"
    readonly receivedAtMs: number
}

export type RunResumeReason = "suspension" | "failure"

export type RunOutcome = { status: "success" } | { status: "skipped"; reason: string } | { status: "suspended" } | { status: "failed"; cause: unknown }

export interface JobExecutor {
    readonly kind: JobExecutionKind
    execute(context: JobExecutionContext): Promise<RunOutcome>
}

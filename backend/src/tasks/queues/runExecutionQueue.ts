import { Boss } from "../../loaders/pgBoss"
import { HookResume, JobExecutionKind, ResumeSignal } from "../../services/jobExecutors/types"

import { QueueName } from "./queueNames"

export function runExecutionJobId(runId: string): string {
    return `run-${runId}`
}

export async function enqueueRunExecution(data: RunExecutionJobData, opts?: { delaySeconds?: number; resumeSignal?: ResumeSignal }): Promise<void> {
    const enqueuedAtMs = Date.now()
    const scheduledForMs = opts?.delaySeconds ? enqueuedAtMs + opts.delaySeconds * 1000 : undefined
    const resumeSignal = opts?.resumeSignal ?? (scheduledForMs && data.restoreImageId ? { kind: "timer" as const, receivedAtMs: scheduledForMs } : undefined)
    const payload: RunExecutionJobData = {
        ...data,
        enqueuedAtMs,
        ...(scheduledForMs ? { scheduledForMs } : {}),
        ...(resumeSignal ? { resumeSignal } : {})
    }
    const singletonKey = data.failureSnapshotId
        ? retryExecutionJobId(data.runId, data.failureSnapshotId)
        : data.restoreImageId
          ? resumeExecutionJobId(data.runId, data.restoreImageId)
          : runExecutionJobId(data.runId)
    const delay = opts?.delaySeconds ? { startAfter: opts.delaySeconds } : {}
    await Boss.getInstance()
        .getBoss()
        .send(QueueName.SdkRunExecution, payload, { singletonKey, ...delay })
}

function resumeExecutionJobId(runId: string, restoreImageId: string): string {
    return `resume-${runId}-${restoreImageId}`
}

function retryExecutionJobId(runId: string, failureSnapshotId: string): string {
    return `retry-${runId}-${failureSnapshotId}`
}

export interface RunExecutionJobData {
    runId: string
    agentId: string
    orgId: string
    userId: string
    jobName: string
    kind: JobExecutionKind
    restoreImageId?: string
    /** Failure snapshot row to claim in the worker before restoring its image. */
    failureSnapshotId?: string
    hookResume?: HookResume
    resumeSignal?: ResumeSignal
    enqueuedAtMs?: number
    scheduledForMs?: number
}

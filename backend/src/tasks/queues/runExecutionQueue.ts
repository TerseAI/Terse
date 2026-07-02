/**
 * Producer for the `sdk-run-execution` queue — durable agent run execution.
 *
 * The payload is fully self-contained (ids only): the worker re-loads the agent and reconstructs a
 * server-side user session, so nothing relies on in-memory request state. Idempotency is keyed by
 * `run-<runId>` (the pg-boss singletonKey) and the queue never auto-retries a side-effecting run
 * (retryLimit 0), so an at-least-once enqueue can't spawn two Modal sandboxes or double-bill.
 *
 * Resumes of suspended runs re-enter through the same queue as delayed jobs (`startAfter`) with a
 * per-snapshot key: the original `run-<runId>` job is still active when the run suspends itself, and
 * the queue's `exclusive` policy would silently drop a duplicate key. Single-flight for resumes is
 * guaranteed by the dispatcher's `claimSuspendedRun`.
 */
import { Boss } from "../../loaders/pgBoss"
import { JobExecutionKind } from "../../services/jobExecutors/types"

import { QueueName } from "./queueNames"

export function runExecutionJobId(runId: string): string {
    return `run-${runId}`
}

export async function enqueueRunExecution(data: RunExecutionJobData, opts?: { delaySeconds?: number }): Promise<void> {
    const singletonKey = data.restoreImageId ? resumeExecutionJobId(data.runId, data.restoreImageId) : runExecutionJobId(data.runId)
    const delay = opts?.delaySeconds ? { startAfter: opts.delaySeconds } : {}
    await Boss.getInstance()
        .getBoss()
        .send(QueueName.SdkRunExecution, data, { singletonKey, ...delay })
}

function resumeExecutionJobId(runId: string, restoreImageId: string): string {
    return `resume-${runId}-${restoreImageId}`
}

export interface RunExecutionJobData {
    runId: string
    agentId: string
    orgId: string
    userId: string
    jobName: string
    kind: JobExecutionKind
    restoreImageId?: string
}

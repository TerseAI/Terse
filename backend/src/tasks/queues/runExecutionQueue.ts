/**
 * Producer for the `sdk-run-execution` queue — durable agent run execution.
 *
 * The payload is fully self-contained (ids only): the worker re-loads the agent and reconstructs a
 * server-side user session, so nothing relies on in-memory request state. Idempotency is keyed by
 * `run-<runId>` (the pg-boss singletonKey) and the queue never auto-retries a side-effecting run
 * (retryLimit 0), so an at-least-once enqueue can't spawn two Modal sandboxes or double-bill.
 */
import { Boss } from "../../loaders/pgBoss"
import { JobExecutionKind } from "../../services/jobExecutors/types"

import { QueueName } from "./queueNames"

export function runExecutionJobId(runId: string): string {
    return `run-${runId}`
}

/** Throws if Postgres is unavailable; a failed enqueue is a failed operation (no inline fallback). */
export async function enqueueRunExecution(data: RunExecutionJobData): Promise<void> {
    await Boss.getInstance().getBoss().send(QueueName.SdkRunExecution, data, { singletonKey: runExecutionJobId(data.runId) })
}

export interface RunExecutionJobData {
    runId: string
    agentId: string
    orgId: string
    userId: string
    jobName: string
    kind: JobExecutionKind
}

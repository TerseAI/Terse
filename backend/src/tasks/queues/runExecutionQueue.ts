/**
 * Producer for the `sdk-run-execution` queue — durable agent run execution.
 *
 * The payload is fully self-contained (ids only): the worker re-loads the agent and reconstructs a
 * server-side user session, so nothing relies on in-memory request state. Idempotency is keyed by
 * `run-<runId>` and we never auto-retry a side-effecting run (attempts: 1), so an at-least-once
 * enqueue can't spawn two Modal sandboxes or double-bill.
 */
import { getQueue } from "../../loaders/bullmq"

import { QueueName } from "./queueNames"

export interface RunExecutionJobData {
    runId: string
    agentId: string
    orgId: string
    userId: string
    jobName: string
}

// BullMQ custom job ids cannot contain ":".
export function runExecutionJobId(runId: string): string {
    return `run-${runId}`
}

export async function enqueueRunExecution(data: RunExecutionJobData): Promise<void> {
    await getQueue(QueueName.SdkRunExecution).add("start", data, {
        jobId: runExecutionJobId(data.runId),
        attempts: 1,
        removeOnComplete: { age: 86_400, count: 1000 },
        removeOnFail: { age: 604_800 }
    })
}

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

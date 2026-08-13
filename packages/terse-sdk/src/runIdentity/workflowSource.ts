import type { RunIdentitySource } from "./index.js"

export const workflowRunIdentitySource: RunIdentitySource = {
    async resolve() {
        try {
            const { getWorkflowMetadata } = await import("@workflow/core")
            const { getWorld } = await import("@workflow/core/runtime")
            const workflowRunId = getWorkflowMetadata().workflowRunId
            const world = await getWorld()
            const { attributes } = await world.runs.get(workflowRunId)
            return { sessionId: attributes?.sessionId, runId: attributes?.runId, projectId: attributes?.projectId, jobName: attributes?.jobName }
        } catch {
            return null
        }
    }
}

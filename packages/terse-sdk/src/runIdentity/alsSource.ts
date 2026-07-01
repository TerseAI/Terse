import type { RunIdentitySource } from "./index.js"

export const alsRunIdentitySource: RunIdentitySource = {
    async resolve() {
        const ctx = globalThis.__terseJobContextStore?.getStore()
        if (!ctx) return null
        return { sessionId: ctx.sessionId, runId: ctx.runId ?? undefined, projectId: ctx.projectId, jobName: ctx.jobName }
    }
}

import { alsRunIdentitySource } from "./alsSource.js"
import { workflowRunIdentitySource } from "./workflowSource.js"

export type RunIdentity = { sessionId?: string; runId?: string; projectId?: string; jobName?: string }

export interface RunIdentitySource {
    resolve(): Promise<RunIdentity | null>
}

const sources: RunIdentitySource[] = [alsRunIdentitySource, workflowRunIdentitySource]

export async function resolveRunIdentity(): Promise<RunIdentity> {
    for (const source of sources) {
        const identity = await source.resolve()
        if (identity) return identity
    }
    return {}
}

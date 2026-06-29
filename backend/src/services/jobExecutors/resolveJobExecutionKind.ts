import { AgentWithRelations, project_deploys } from "../../types/prisma"

import { JobExecutionKind } from "./types"

// The single place the persisted-column branch survives, now producing a typed discriminant that
// flows through the queue instead of being re-derived from DB rows at every dispatch site.
export function resolveJobExecutionKind(agent: AgentWithRelations, activeDeploy: project_deploys | null): JobExecutionKind {
    if (agent.project.remote_server_url) {
        return "remote-webhook"
    }
    if (activeDeploy?.sdk_source_image_id) {
        return "sandbox"
    }
    throw new Error("Unknown agent source")
}

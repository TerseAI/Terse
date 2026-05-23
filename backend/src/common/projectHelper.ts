import { db } from "../loaders/prisma"
import { AgentWithRelations, project_deploys } from "../types/prisma"

export async function getActiveDeployForProject(projectId: string): Promise<project_deploys | null> {
    return db().project_deploys.findFirst({
        where: { project_id: projectId, status: "SUCCEEDED" },
        orderBy: { created_at: "desc" }
    })
}

export async function getActiveSourceImageIdForAutomation(automation: AgentWithRelations): Promise<string | null> {
    const deploy = await getActiveDeployForProject(automation.project.id)
    return deploy?.sdk_source_image_id ?? null
}

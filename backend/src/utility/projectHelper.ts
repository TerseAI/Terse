import { db } from "../prismaClient"
import { AgentWithRelations, project_deploys } from "../types/prisma"

export async function getActiveDeployForProject(projectId: string): Promise<project_deploys | null> {
    const deploy = await db().project_deploys.findFirst({
        where: {
            project_id: projectId,
            status: "SUCCEEDED"
        },
        orderBy: {
            created_at: "desc"
        }
    })

    return deploy
}

export async function getActiveSourceCodeGcsKeyForProject(projectId: string): Promise<string | null> {
    const deploy = await db().project_deploys.findFirst({
        where: { project_id: projectId, status: "SUCCEEDED" },
        orderBy: { created_at: "desc" },
        include: { sdk_source_image: true }
    })
    return deploy?.sdk_source_image?.gcs_key ?? null
}

export async function getActiveSourceCodeGcsKeyForAutomation(automation: AgentWithRelations): Promise<string | null> {
    return getActiveSourceCodeGcsKeyForProject(automation.project.id)
}

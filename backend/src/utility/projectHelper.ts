import { db } from "../prismaClient"
import { AgentWithRelations, SDKAgent, isSDKAgent, project_deploys } from "../types/prisma"

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
    const deploy = await getActiveDeployForProject(projectId)
    return deploy?.sdk_source_image_id ?? null
}

export async function getActiveSourceCodeGcsKeyForJob(agent: SDKAgent): Promise<string | null> {
    const activeDeploy = await getActiveDeployForProject(agent.project.id)
    return activeDeploy?.sdk_source_image_id ?? null
}

export async function getActiveSourceCodeGcsKeyForAutomation(automation: AgentWithRelations): Promise<string | null> {
    if (!isSDKAgent(automation)) {
        return null
    }

    const activeDeploy = await getActiveDeployForProject(automation.project.id)
    return activeDeploy?.sdk_source_image_id ?? null
}
export async function getRemoteServerUrlForAutomation(automation: AgentWithRelations): Promise<string | null> {
    if (!isSDKAgent(automation)) {
        return null
    }

    return automation.project.remote_server_url ?? null
}

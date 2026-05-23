import { db } from "../loaders/prisma"
import { project_deploys } from "../types/prisma"

export async function getActiveDeployForProject(projectId: string): Promise<project_deploys | null> {
    return db().project_deploys.findFirst({
        where: { project_id: projectId, status: "SUCCEEDED" },
        orderBy: { created_at: "desc" }
    })
}

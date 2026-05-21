import { db } from "../../../loaders/prisma"

export type ProjectAccess = {
    id: string
    organization_id: string
    remote_server_url: string | null
}

export async function findProjectForSecretAccess(projectId: string, organizationId: string): Promise<ProjectAccess | null> {
    return db().projects.findFirst({
        where: { id: projectId, organization_id: organizationId },
        select: { id: true, organization_id: true, remote_server_url: true }
    })
}

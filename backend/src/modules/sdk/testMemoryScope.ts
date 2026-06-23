import { Request } from "express"
import { UserSession } from "terse-types/types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"

export type TestMemoryScope = { projectId: string; jobName: string }

export async function userOwnsProject(projectId: string | undefined, user: UserSession): Promise<string | null> {
    const trimmed = projectId?.trim()
    if (!trimmed || !user.organizationId) return null
    const project = await db().projects.findFirst({
        where: { id: trimmed, organization_id: user.organizationId },
        select: { id: true }
    })
    if (!project) {
        logger.warn("[sdk] Rejecting cross-tenant project access", { requestedProjectId: trimmed, userId: user.id, organizationId: user.organizationId })
        return null
    }
    return trimmed
}

export async function resolveTestMemoryScope(req: Request, user: UserSession): Promise<TestMemoryScope | null> {
    const jobName = (req.headers["x-terse-job-name"] as string | undefined)?.trim()
    if (!jobName) return null
    const projectId = await userOwnsProject(req.headers["x-terse-project-id"] as string | undefined, user)
    if (!projectId) return null
    return { projectId, jobName }
}

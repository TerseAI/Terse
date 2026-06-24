import { Request } from "express"
import { UserSession } from "terse-types/types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"

export type TestRunContext = { projectId: string; jobName: string }

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

/** A `terse test` run carries its project + job via headers (no run-id, since the record is minted here). */
export async function resolveTestRunContext(req: Request, user: UserSession): Promise<TestRunContext | null> {
    const jobName = (req.headers["x-terse-job-name"] as string | undefined)?.trim()
    if (!jobName) return null
    const projectId = await userOwnsProject(req.headers["x-terse-project-id"] as string | undefined, user)
    if (!projectId) return null
    return { projectId, jobName }
}

/**
 * Find-or-create the automation a test run keys off (run history + memory subtree). When the job hasn't been
 * deployed yet this creates an inert draft (is_active false, deployed_at null, no triggers); a later
 * `terse deploy` promotes it by name. Returns the automation id.
 */
export async function ensureTestAutomation(user: UserSession, projectId: string, jobName: string): Promise<string> {
    const prisma = db()
    const existing = await prisma.automations.findFirst({
        where: { name: jobName, organization_id: user.organizationId, project_id: projectId },
        select: { id: true }
    })
    if (existing) return existing.id

    const created = await prisma.automations.create({
        data: { user_id: user.id, organization_id: user.organizationId, name: jobName, project_id: projectId, is_active: false, require_approval: false }
    })
    await prisma.automation_prompts.create({ data: { automation_id: created.id, content: "[SDK test]" } })
    logger.info("[sdk] created draft automation for test run", { automationId: created.id, jobName, projectId })
    return created.id
}

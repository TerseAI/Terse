import { DurableJournalBackend, UserSession } from "terse-types/types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"

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

export async function ensureTestAutomation(user: UserSession, projectId: string, jobName: string, durable: boolean, durableJournalBackend?: DurableJournalBackend): Promise<string> {
    const prisma = db()
    const existing = await prisma.automations.findFirst({
        where: { name: jobName, organization_id: user.organizationId, project_id: projectId },
        select: { id: true, is_durable: true, durable_journal_backend: true }
    })
    if (existing) {
        if (existing.is_durable !== durable || existing.durable_journal_backend !== (durableJournalBackend ?? null)) {
            await prisma.automations.update({
                where: { id: existing.id },
                data: { is_durable: durable, durable_journal_backend: durableJournalBackend ?? null }
            })
        }
        return existing.id
    }

    const created = await prisma.automations.create({
        data: {
            user_id: user.id,
            organization_id: user.organizationId,
            name: jobName,
            project_id: projectId,
            is_active: false,
            is_durable: durable,
            durable_journal_backend: durableJournalBackend ?? null,
            require_approval: false
        }
    })
    await prisma.automation_prompts.create({ data: { automation_id: created.id, content: "[SDK test]" } })
    logger.info("[sdk] created draft automation for test run", { automationId: created.id, jobName, projectId })
    return created.id
}

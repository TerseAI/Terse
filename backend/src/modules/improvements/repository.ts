import { AgentImprovementStatus } from "@prisma/client"

import { db } from "../../loaders/prisma"

export async function findAutomationInOrg(agentId: string, organizationId: string) {
    return db().automations.findFirst({
        where: { id: agentId, organization_id: organizationId },
        select: { id: true, improvements_enabled: true }
    })
}

export async function findLatestReviewForAgent(agentId: string, organizationId: string) {
    return db().agent_reviews.findFirst({
        where: { automation_id: agentId, organization_id: organizationId },
        orderBy: { created_at: "desc" }
    })
}

export async function findImprovementsForReview(reviewId: string) {
    return db().agent_improvements.findMany({
        where: { review_id: reviewId },
        orderBy: { created_at: "asc" }
    })
}

export async function findImprovementWithAutomation(improvementId: string, agentId: string, organizationId: string) {
    return db().agent_improvements.findFirst({
        where: {
            id: improvementId,
            automation_id: agentId,
            automation: { organization_id: organizationId }
        },
        include: { automation: { select: { name: true } } }
    })
}

export async function findImprovementBasic(improvementId: string, agentId: string, organizationId: string) {
    return db().agent_improvements.findFirst({
        where: {
            id: improvementId,
            automation_id: agentId,
            automation: { organization_id: organizationId }
        },
        select: { id: true, status: true }
    })
}

export async function applyImprovementInDb(improvementId: string, appliedPrompt: string): Promise<void> {
    await db().agent_improvements.update({
        where: { id: improvementId },
        data: { status: AgentImprovementStatus.APPLIED, applied_prompt: appliedPrompt, applied_at: new Date() }
    })
}

export async function dismissImprovementInDb(improvementId: string): Promise<void> {
    await db().agent_improvements.update({
        where: { id: improvementId },
        data: { status: AgentImprovementStatus.DISMISSED, dismissed_at: new Date() }
    })
}

export async function undoDismissImprovementInDb(improvementId: string): Promise<void> {
    await db().agent_improvements.update({
        where: { id: improvementId },
        data: { status: AgentImprovementStatus.PENDING, dismissed_at: null }
    })
}

export async function toggleImprovementsEnabledInDb(agentId: string, organizationId: string, enabled: boolean): Promise<number> {
    const result = await db().automations.updateMany({
        where: { id: agentId, organization_id: organizationId },
        data: { improvements_enabled: enabled }
    })
    return result.count
}

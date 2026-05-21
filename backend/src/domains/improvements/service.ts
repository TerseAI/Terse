import { AgentImprovementStatus } from "@prisma/client"
import { AgentImprovement, AgentReview, GetAgentImprovementsResponse } from "terse-types/types"

import { emitCacheInvalidationWithKey } from "../../services/CacheInvalidationService"

import {
    applyImprovementInDb,
    dismissImprovementInDb,
    findAutomationInOrg,
    findImprovementBasic,
    findImprovementWithAutomation,
    findImprovementsForReview,
    findLatestReviewForAgent,
    toggleImprovementsEnabledInDb,
    undoDismissImprovementInDb
} from "./repository"

const AGENT_IMPROVEMENTS_INVALIDATION_KEY = "agentImprovements"

export class AgentNotFoundError extends Error {
    constructor() {
        super("Agent not found")
        this.name = "AgentNotFoundError"
    }
}

export class ImprovementNotFoundError extends Error {
    constructor() {
        super("Improvement not found")
        this.name = "ImprovementNotFoundError"
    }
}

export class ImprovementConflictError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ImprovementConflictError"
    }
}

function mapReview(review: {
    id: string
    automation_id: string
    title: string
    summary: string
    runs_analyzed: number
    review_period_start: Date
    review_period_end: Date
    created_at: Date
}): AgentReview {
    return {
        id: review.id,
        automationId: review.automation_id,
        title: review.title || `Last review at ${review.created_at.toLocaleDateString()}`,
        summary: review.summary,
        runsAnalyzed: review.runs_analyzed,
        reviewPeriodStart: review.review_period_start.toISOString(),
        reviewPeriodEnd: review.review_period_end.toISOString(),
        createdAt: review.created_at.toISOString()
    }
}

function mapImprovement(improvement: {
    id: string
    review_id: string
    automation_id: string
    title: string
    description: string
    target_area: string
    confidence: number
    status: AgentImprovementStatus
    suggested_patch: string | null
    applied_prompt: string | null
    applied_at: Date | null
    dismissed_at: Date | null
    created_at: Date
    updated_at: Date
}): AgentImprovement {
    return {
        id: improvement.id,
        reviewId: improvement.review_id,
        automationId: improvement.automation_id,
        title: improvement.title,
        description: improvement.description,
        targetArea: improvement.target_area as AgentImprovement["targetArea"],
        confidence: improvement.confidence,
        status: improvement.status,
        suggestedPatch: improvement.suggested_patch ?? undefined,
        appliedPrompt: improvement.applied_prompt ?? undefined,
        appliedAt: improvement.applied_at?.toISOString(),
        dismissedAt: improvement.dismissed_at?.toISOString(),
        createdAt: improvement.created_at.toISOString(),
        updatedAt: improvement.updated_at.toISOString()
    }
}

function buildAppliedPrompt(automationName: string, improvement: { title: string; description: string; target_area: string }): string {
    return [
        `Please implement this improvement on my automation "${automationName}".`,
        `Improvement title: ${improvement.title}`,
        `Target area: ${improvement.target_area}`,
        `Details: ${improvement.description}`,
        "Apply the change directly to the agent configuration and explain what you changed."
    ].join("\n")
}

export async function listImprovementsForAgent(agentId: string, organizationId: string): Promise<GetAgentImprovementsResponse> {
    const automation = await findAutomationInOrg(agentId, organizationId)
    if (!automation) throw new AgentNotFoundError()

    const review = await findLatestReviewForAgent(agentId, organizationId)
    const improvements = review ? await findImprovementsForReview(review.id) : []

    return {
        review: review ? mapReview(review) : null,
        improvements: improvements.map(mapImprovement),
        improvementsEnabled: automation.improvements_enabled
    }
}

export async function applyImprovementForAgent(improvementId: string, agentId: string, organizationId: string): Promise<{ appliedPrompt: string }> {
    const improvement = await findImprovementWithAutomation(improvementId, agentId, organizationId)
    if (!improvement) throw new ImprovementNotFoundError()
    if (improvement.status !== AgentImprovementStatus.PENDING) throw new ImprovementConflictError("Improvement is no longer pending")

    const appliedPrompt = buildAppliedPrompt(improvement.automation.name, improvement)
    await applyImprovementInDb(improvement.id, appliedPrompt)
    emitCacheInvalidationWithKey(organizationId, AGENT_IMPROVEMENTS_INVALIDATION_KEY)
    return { appliedPrompt }
}

export async function dismissImprovementForAgent(improvementId: string, agentId: string, organizationId: string): Promise<void> {
    const improvement = await findImprovementBasic(improvementId, agentId, organizationId)
    if (!improvement) throw new ImprovementNotFoundError()
    if (improvement.status !== AgentImprovementStatus.PENDING) throw new ImprovementConflictError("Improvement is no longer pending")
    await dismissImprovementInDb(improvement.id)
    emitCacheInvalidationWithKey(organizationId, AGENT_IMPROVEMENTS_INVALIDATION_KEY)
}

export async function undoDismissImprovementForAgent(improvementId: string, agentId: string, organizationId: string): Promise<void> {
    const improvement = await findImprovementBasic(improvementId, agentId, organizationId)
    if (!improvement) throw new ImprovementNotFoundError()
    if (improvement.status !== AgentImprovementStatus.DISMISSED) throw new ImprovementConflictError("Improvement is not dismissed")
    await undoDismissImprovementInDb(improvement.id)
    emitCacheInvalidationWithKey(organizationId, AGENT_IMPROVEMENTS_INVALIDATION_KEY)
}

export async function toggleImprovementsEnabledForAgent(agentId: string, organizationId: string, enabled: boolean): Promise<void> {
    const count = await toggleImprovementsEnabledInDb(agentId, organizationId, enabled)
    if (count !== 1) throw new AgentNotFoundError()
    emitCacheInvalidationWithKey(organizationId, AGENT_IMPROVEMENTS_INVALIDATION_KEY)
}

import { AgentImprovementStatus } from "@prisma/client"
import { Request, Response } from "express"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../services/CacheInvalidationService"
import {
    AgentImprovement,
    AgentReview,
    ApplyImprovementResponse,
    DismissImprovementResponse,
    GetAgentImprovementsResponse,
    ToggleImprovementsEnabledResponse
} from "../shared/types"

const AGENT_IMPROVEMENTS_INVALIDATION_KEY = "agentImprovements"

function mapReview(review: {
    id: string
    automation_id: string
    score_task_quality: number
    score_consistency: number
    score_efficiency: number
    overall_score: number
    summary: string
    runs_analyzed: number
    review_period_start: Date
    review_period_end: Date
    created_at: Date
}): AgentReview {
    return {
        id: review.id,
        automationId: review.automation_id,
        scoreTaskQuality: review.score_task_quality,
        scoreConsistency: review.score_consistency,
        scoreEfficiency: review.score_efficiency,
        overallScore: review.overall_score,
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

function requireAuth(req: Request, res: Response): { userId: string; organizationId: string } | null {
    const user = req.session?.user
    if (!user) {
        res.status(401).json({ error: "Unauthorized" })
        return null
    }
    if (!user.organizationId) {
        res.status(400).json({ error: "Organization context is required" })
        return null
    }
    return { userId: user.id, organizationId: user.organizationId }
}

export async function getAgentImprovements(req: Request, res: Response) {
    const auth = requireAuth(req, res)
    if (!auth) return

    const agentId = req.params.agentId?.trim()
    if (!agentId) {
        return res.status(400).json({ error: "agentId is required" })
    }

    try {
        const automation = await db().automations.findFirst({
            where: {
                id: agentId,
                organization_id: auth.organizationId
            },
            select: {
                id: true,
                improvements_enabled: true
            }
        })

        if (!automation) {
            return res.status(404).json({ error: "Agent not found" })
        }

        const review = await db().agent_reviews.findFirst({
            where: {
                automation_id: agentId,
                organization_id: auth.organizationId
            },
            orderBy: {
                created_at: "desc"
            }
        })

        const improvements = review
            ? await db().agent_improvements.findMany({
                  where: { review_id: review.id },
                  orderBy: { created_at: "asc" }
              })
            : []

        const response: GetAgentImprovementsResponse = {
            review: review ? mapReview(review) : null,
            improvements: improvements.map(mapImprovement),
            improvementsEnabled: automation.improvements_enabled
        }

        return res.status(200).json(response)
    } catch (error) {
        logger.error("[Improvements] Failed to fetch improvements", {
            error,
            agentId,
            organizationId: auth.organizationId
        })
        return res.status(500).json({ error: "Failed to fetch improvements" })
    }
}

export async function applyImprovement(req: Request, res: Response) {
    const auth = requireAuth(req, res)
    if (!auth) return

    const agentId = req.params.agentId?.trim()
    const improvementId = req.params.id?.trim()

    if (!agentId || !improvementId) {
        return res.status(400).json({ error: "agentId and improvement id are required" })
    }

    try {
        const improvement = await db().agent_improvements.findFirst({
            where: {
                id: improvementId,
                automation_id: agentId,
                automation: { organization_id: auth.organizationId }
            },
            include: {
                automation: {
                    select: {
                        name: true
                    }
                }
            }
        })

        if (!improvement) {
            return res.status(404).json({ error: "Improvement not found" })
        }

        if (improvement.status !== AgentImprovementStatus.PENDING) {
            return res.status(409).json({ error: "Improvement is no longer pending" })
        }

        const appliedPrompt = buildAppliedPrompt(improvement.automation.name, improvement)

        await db().agent_improvements.update({
            where: { id: improvement.id },
            data: {
                status: AgentImprovementStatus.APPLIED,
                applied_prompt: appliedPrompt,
                applied_at: new Date()
            }
        })

        emitCacheInvalidationWithKey(auth.organizationId, AGENT_IMPROVEMENTS_INVALIDATION_KEY)

        const response: ApplyImprovementResponse = {
            success: true,
            appliedPrompt
        }

        return res.status(200).json(response)
    } catch (error) {
        logger.error("[Improvements] Failed to apply improvement", {
            error,
            agentId,
            improvementId,
            organizationId: auth.organizationId
        })
        return res.status(500).json({ error: "Failed to apply improvement" })
    }
}

export async function dismissImprovement(req: Request, res: Response) {
    const auth = requireAuth(req, res)
    if (!auth) return

    const agentId = req.params.agentId?.trim()
    const improvementId = req.params.id?.trim()

    if (!agentId || !improvementId) {
        return res.status(400).json({ error: "agentId and improvement id are required" })
    }

    try {
        const improvement = await db().agent_improvements.findFirst({
            where: {
                id: improvementId,
                automation_id: agentId,
                automation: { organization_id: auth.organizationId }
            },
            select: {
                id: true,
                status: true
            }
        })

        if (!improvement) {
            return res.status(404).json({ error: "Improvement not found" })
        }

        if (improvement.status !== AgentImprovementStatus.PENDING) {
            return res.status(409).json({ error: "Improvement is no longer pending" })
        }

        await db().agent_improvements.update({
            where: { id: improvement.id },
            data: {
                status: AgentImprovementStatus.DISMISSED,
                dismissed_at: new Date()
            }
        })

        emitCacheInvalidationWithKey(auth.organizationId, AGENT_IMPROVEMENTS_INVALIDATION_KEY)

        const response: DismissImprovementResponse = {
            success: true
        }

        return res.status(200).json(response)
    } catch (error) {
        logger.error("[Improvements] Failed to dismiss improvement", {
            error,
            agentId,
            improvementId,
            organizationId: auth.organizationId
        })
        return res.status(500).json({ error: "Failed to dismiss improvement" })
    }
}

export async function toggleImprovementsEnabled(req: Request, res: Response) {
    const auth = requireAuth(req, res)
    if (!auth) return

    const agentId = req.params.agentId?.trim()
    if (!agentId) {
        return res.status(400).json({ error: "agentId is required" })
    }

    const enabled = req.body?.enabled
    if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" })
    }

    try {
        const result = await db().automations.updateMany({
            where: {
                id: agentId,
                organization_id: auth.organizationId
            },
            data: {
                improvements_enabled: enabled
            }
        })

        if (result.count !== 1) {
            return res.status(404).json({ error: "Agent not found" })
        }

        emitCacheInvalidationWithKey(auth.organizationId, AGENT_IMPROVEMENTS_INVALIDATION_KEY)

        const response: ToggleImprovementsEnabledResponse = {
            success: true,
            improvementsEnabled: enabled
        }

        return res.status(200).json(response)
    } catch (error) {
        logger.error("[Improvements] Failed to toggle improvements_enabled", {
            error,
            agentId,
            organizationId: auth.organizationId,
            enabled
        })
        return res.status(500).json({ error: "Failed to update improvements setting" })
    }
}

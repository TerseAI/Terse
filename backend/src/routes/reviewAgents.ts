import { Request, Response } from "express"

import { NotificationDestinationType, SentNotificationEventType, SentNotificationStatus } from "@prisma/client"

import { computeOverallScore, evaluateAgent } from "../agent/JudgeAgent/JudgeAgent"
import { cloudScheduler, settings } from "../config/settings"
import logger from "../logger"
import { sendWeeklyReviewEmail } from "../notifications/channels/emailNotifications"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../services/CacheInvalidationService"
import { FrontendRoutes } from "../shared/FrontendRoutes"
import { sentNotificationsKey } from "../shared/InvalidationKeys"
import { getUserForOrg } from "../utility/workos"

type EmailAgentSummary = {
    name: string
    overallScore: number
    improvements: Array<{ title: string }>
    improvementsUrl: string
}

type EmailGroup = {
    emailAddress: string
    organizationId: string
    agents: EmailAgentSummary[]
}

function validateCloudSchedulerRequest(req: Request): boolean {
    return true
    // const authHeader = req.headers["authorization"]
    // if (!authHeader) {
    //     logger.warn("[ReviewAgents] Missing Authorization header")
    //     return false
    // }
    // const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader
    // if (token !== cloudScheduler.secret) {
    //     logger.warn("[ReviewAgents] Invalid cron secret token")
    //     return false
    // }
    // return true
}

export async function reviewAllAgents(req: Request, res: Response) {
    logger.info("[ReviewAgents] Weekly review job triggered")

    if (!validateCloudSchedulerRequest(req)) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const periodEnd = new Date()
    const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000)

    try {
        const automations = await db().automations.findMany({
            where: {
                is_active: true,
                improvements_enabled: true
            },
            select: {
                id: true,
                name: true,
                user_id: true,
                organization_id: true
            }
        })

        const userCache = new Map<string, Awaited<ReturnType<typeof getUserForOrg>>>()
        const emailGroups = new Map<string, EmailGroup>()
        const failures: Array<{ automationId: string; error: string }> = []

        let reviewedAgents = 0
        let skippedNoRuns = 0
        let improvementsCreated = 0

        for (const automation of automations) {
            try {
                const userCacheKey = `${automation.user_id}:${automation.organization_id}`
                if (!userCache.has(userCacheKey)) {
                    userCache.set(userCacheKey, await getUserForOrg(automation.user_id, automation.organization_id))
                }
                const user = userCache.get(userCacheKey)
                if (!user) {
                    failures.push({ automationId: automation.id, error: "User not found for organization context" })
                    continue
                }

                if (!emailGroups.has(user.id)) {
                    emailGroups.set(user.id, { emailAddress: user.email, organizationId: user.organizationId, agents: [] })
                }

                const runCount = await db().run_history_records.count({
                    where: {
                        automation_id: automation.id,
                        timestamp: {
                            gte: periodStart,
                            lte: periodEnd
                        }
                    }
                })

                if (runCount === 0) {
                    skippedNoRuns += 1
                    continue
                }

                const evaluation = await evaluateAgent({
                    automationId: automation.id,
                    user
                })

                const overallScore = computeOverallScore(evaluation)
                const improvementRecords = evaluation.improvements

                await db().$transaction(async tx => {
                    const review = await tx.agent_reviews.create({
                        data: {
                            automation_id: automation.id,
                            organization_id: automation.organization_id,
                            score_task_quality: evaluation.scoreTaskQuality,
                            score_consistency: evaluation.scoreConsistency,
                            score_efficiency: evaluation.scoreEfficiency,
                            overall_score: overallScore,
                            summary: evaluation.summary,
                            runs_analyzed: runCount,
                            review_period_start: periodStart,
                            review_period_end: periodEnd
                        }
                    })

                    if (improvementRecords.length > 0) {
                        await tx.agent_improvements.createMany({
                            data: improvementRecords.map(improvement => ({
                                review_id: review.id,
                                automation_id: automation.id,
                                title: improvement.title,
                                description: improvement.description,
                                target_area: improvement.targetArea,
                                confidence: improvement.confidence
                            }))
                        })
                    }
                })

                reviewedAgents += 1
                improvementsCreated += improvementRecords.length

                if (improvementRecords.length > 0) {
                    const improvementsPath = FrontendRoutes.AGENTS.IMPROVEMENTS(automation.id)
                    const improvementsUrl = settings.urls.frontend ? `${settings.urls.frontend}${improvementsPath}` : improvementsPath
                    const group = emailGroups.get(user.id)!
                    group.agents.push({
                        name: automation.name,
                        overallScore,
                        improvements: improvementRecords.map(item => ({ title: item.title })),
                        improvementsUrl
                    })
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                failures.push({ automationId: automation.id, error: message })
                logger.error("[ReviewAgents] Failed to review automation", {
                    automationId: automation.id,
                    error
                })
            }
        }

        let emailsSent = 0

        for (const [userId, group] of emailGroups.entries()) {
            let emailError: unknown
            try {
                await sendWeeklyReviewEmail(group.emailAddress, group.agents)
                emailsSent += 1
            } catch (error) {
                emailError = error
                logger.error("[ReviewAgents] Failed to send weekly review email", {
                    emailAddress: group.emailAddress,
                    error
                })
                failures.push({
                    automationId: "email",
                    error: `Failed to send email to ${group.emailAddress}: ${error instanceof Error ? error.message : String(error)}`
                })
            }

            // Track the weekly review email in sent_notifications
            try {
                const agentNames = group.agents.map(a => a.name).join(", ")
                await db().sent_notifications.create({
                    data: {
                        organization_id: group.organizationId,
                        user_id: userId,
                        automation_id: null,
                        run_id: null,
                        event_type: SentNotificationEventType.weekly_review,
                        destination_type: NotificationDestinationType.EMAIL,
                        destination_label: group.emailAddress,
                        status: emailError ? SentNotificationStatus.failed : SentNotificationStatus.sent,
                        error_message: emailError instanceof Error ? emailError.message : emailError ? String(emailError) : null,
                        agent_name: agentNames
                    }
                })
                emitCacheInvalidationWithKey(group.organizationId, sentNotificationsKey()[0])
            } catch (trackError) {
                logger.error("[ReviewAgents] Failed to track weekly review notification", { error: trackError })
            }
        }

        return res.status(200).json({
            success: true,
            summary: {
                scannedAgents: automations.length,
                reviewedAgents,
                skippedNoRuns,
                improvementsCreated,
                emailsSent,
                failures: failures.length
            },
            failures
        })
    } catch (error) {
        logger.error("[ReviewAgents] Weekly review job failed", { error })
        return res.status(500).json({
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error"
        })
    }
}

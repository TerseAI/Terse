import { NotificationDestinationType, SentNotificationEventType, SentNotificationStatus } from "@prisma/client"
import { Request, Response } from "express"
import { buildRoute } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { sentNotificationsKey } from "terse-types/InvalidationKeys"
import { User } from "terse-types/types"

import { FeatureFlag, FeatureFlagService } from "../../../common/featureFlags"
import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { MAX_IMPROVEMENTS_PER_AGENT } from "../../../domains/agents/JudgeAgent/JudgeAgent"
import { fetchFullJudgeContext } from "../../../domains/agents/JudgeAgent/fetchJudgeContext"
import { getUserForOrg } from "../../../integrations/workos/helpers"
import { db } from "../../../loaders/prisma"
import { sendWeeklyReviewEmail } from "../../../notifications/channels/emailNotifications"
import { emitCacheInvalidationWithKey } from "../../../services/CacheInvalidationService"
import { SdkImprovementService } from "../../../services/SdkImprovementService"
import { settings } from "../../../settings"

type EligibleAutomation = {
    id: string
    name: string
    user_id: string
    organization_id: string
    user: User
    runCount: number
}

type EmailAgentSummary = {
    name: string
    improvements: Array<{ title: string }>
    improvementsUrl: string
}

type EmailGroup = {
    emailAddress: string
    organizationId: string
    agents: EmailAgentSummary[]
}

export async function reviewAllAgents(req: Request, res: Response) {
    logger.info("[ReviewAgents] Weekly review job triggered")

    const featureFlagService = FeatureFlagService.getInstance()
    const periodEnd = new Date()
    const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000)

    try {
        const automations = await db().automations.findMany({
            where: { is_active: true, improvements_enabled: true },
            select: { id: true, name: true, user_id: true, organization_id: true }
        })

        const userCache = new Map<string, Awaited<ReturnType<typeof getUserForOrg>>>()
        const featureFlagCache = new Map<string, boolean>()
        const emailGroups = new Map<string, EmailGroup>()
        const failures: Array<{ automationId: string; error: string }> = []

        let reviewedAgents = 0
        let skippedNoRuns = 0
        let skippedTooManyImprovements = 0
        let improvementsCreated = 0

        const eligible: EligibleAutomation[] = []

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

                if (!featureFlagCache.has(user.email)) {
                    const isEnabled = await featureFlagService.isFeatureFlagEnabled(FeatureFlag.WEEKLY_REVIEW_EMAILS, user.email, { email: user.email })
                    featureFlagCache.set(user.email, isEnabled)
                }
                if (!featureFlagCache.get(user.email)) continue

                if (!emailGroups.has(user.id)) {
                    emailGroups.set(user.id, { emailAddress: user.email, organizationId: user.organizationId, agents: [] })
                }

                const runCount = await db().run_history_records.count({
                    where: { automation_id: automation.id, timestamp: { gte: periodStart, lte: periodEnd } }
                })

                if (runCount === 0) {
                    skippedNoRuns += 1
                    continue
                }

                const improvementCount = await db().agent_improvements.count({ where: { automation_id: automation.id } })

                if (improvementCount >= MAX_IMPROVEMENTS_PER_AGENT) {
                    skippedTooManyImprovements += 1
                    logger.info("[ReviewAgents] Skipping automation with too many total improvements", {
                        automationId: automation.id,
                        improvementCount,
                        maxImprovementsPerAgent: MAX_IMPROVEMENTS_PER_AGENT
                    })
                    continue
                }

                eligible.push({ ...automation, user, runCount })
            } catch (error) {
                const message = extractErrorMessage(error)
                failures.push({ automationId: automation.id, error: message })
                logger.error("[ReviewAgents] Failed pre-check for automation", { automationId: automation.id, error })
            }
        }

        const results = await Promise.allSettled(
            eligible.map(async automation => {
                const context = await fetchFullJudgeContext(automation.id, automation.organization_id)
                const sdkService = new SdkImprovementService()
                const evaluation = await sdkService.evaluate(automation.id, context)
                const improvementRecords = evaluation.improvements

                await db().$transaction(async tx => {
                    const review = await tx.agent_reviews.create({
                        data: {
                            automation_id: automation.id,
                            organization_id: automation.organization_id,
                            title: evaluation.title,
                            summary: evaluation.summary,
                            runs_analyzed: automation.runCount,
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
                                confidence: improvement.confidence,
                                suggested_patch: improvement.suggestedPatch ?? null
                            }))
                        })
                    }
                })

                reviewedAgents += 1
                improvementsCreated += improvementRecords.length

                if (improvementRecords.length > 0) {
                    const improvementsPath = buildRoute(FrontendRoutes.AGENTS.IMPROVEMENTS, { id: automation.id })
                    const improvementsUrl = settings.urls.frontend ? `${settings.urls.frontend}${improvementsPath}` : improvementsPath
                    const group = emailGroups.get(automation.user.id)!
                    group.agents.push({
                        name: automation.name,
                        improvements: improvementRecords.map(item => ({ title: item.title })),
                        improvementsUrl
                    })
                }

                return { automationId: automation.id, improvementCount: improvementRecords.length }
            })
        )

        for (let i = 0; i < results.length; i++) {
            const result = results[i]
            if (result.status === "rejected") {
                const automation = eligible[i]
                const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
                failures.push({ automationId: automation.id, error: message })
                logger.error("[ReviewAgents] Failed to review automation", { automationId: automation.id, error: result.reason })
            }
        }

        let emailsSent = 0

        for (const [userId, group] of emailGroups.entries()) {
            if (group.agents.length === 0) continue

            const userSettings = await db().user_notification_settings.findUnique({
                where: { user_id: userId },
                select: { weekly_agent_improvements: true }
            })
            if (userSettings && !userSettings.weekly_agent_improvements) continue

            let emailError: unknown
            try {
                await sendWeeklyReviewEmail(group.emailAddress, group.agents)
                emailsSent += 1
            } catch (error) {
                emailError = error
                logger.error("[ReviewAgents] Failed to send weekly review email", { emailAddress: group.emailAddress, error })
                failures.push({ automationId: "email", error: `Failed to send email to ${group.emailAddress}: ${extractErrorMessage(error)}` })
            }

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
                        error_message: emailError ? "Failed to send email" : null,
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
            summary: { scannedAgents: automations.length, reviewedAgents, skippedNoRuns, skippedTooManyImprovements, improvementsCreated, emailsSent, failures: failures.length },
            failures
        })
    } catch (error) {
        logger.error("[ReviewAgents] Weekly review job failed", { error })
        return res.status(500).json({ error: "Internal server error" })
    }
}

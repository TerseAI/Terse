import { RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"
import { pendingApprovalsKey } from "terse-types/InvalidationKeys"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { User } from "terse-types/types"

import logger from "../common/logger"
import { getInputConfigInclude, getOutputConfigInclude } from "../common/prismaIncludes"
import { markRunFailed, markRunInProgress } from "../domains/agents/AgentRunner/runHistory"
import { generateApprovalSummary } from "../domains/agents/ApprovalSummaryAgent/ApprovalSummaryAgent"
import { appendToolApprovalResponseSystemEvent } from "../domains/agents/systemEvents/toolApprovalSystemEvent"
import { resolveApprovalDecision } from "../domains/sdk/approval-gate/queue"
import { updateSlackApprovalMessage } from "../integrations/slack/helpers"
import { getUserForOrg } from "../integrations/workos/helpers"
import { db } from "../loaders/prisma"
import { NotificationManager } from "../domains/notifications/Notification"
import { SlackApprovalMessageStatus } from "../integrations/slack/ApprovalStatus"
import { AgentWithRelations } from "../types/prisma"

import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "./CacheInvalidationService"

const PENDING_APPROVALS_INVALIDATION_KEY = pendingApprovalsKey()[0]

export class ApprovalService {
    private static async validateUserAccess(
        runId: string,
        organizationId: string
    ): Promise<{
        runRecord: { id: string; status: PrismaRunHistoryStatus; automation: { id: string; user_id: string; organization_id: string | null } }
        channel: AgentWithRelations
    }> {
        const prisma = db()

        const runRecord = await prisma.run_history_records.findUnique({
            where: { id: runId },
            include: { automation: true }
        })

        if (!runRecord || !runRecord.automation || runRecord.automation.organization_id !== organizationId) {
            throw new Error(`Organization ${organizationId} does not have access to run ${runId}`)
        }

        const channel = await prisma.automations.findUnique({
            where: {
                id: runRecord.automation.id,
                organization_id: organizationId
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                outputs: {
                    include: getOutputConfigInclude()
                },
                tool_approvals: true,
                user: true,
                project: true
            }
        })

        if (!channel) {
            throw new Error(`Channel not found for automation id: ${runRecord.automation.id}`)
        }

        return { runRecord, channel }
    }

    /**
     * Updates Slack notification for an approval request.
     * Handles fetching approval message, cached summary, channel info, and updating both Slack message and database.
     */
    private static async updateSlackNotification(runId: string, stepId: string, status: SlackApprovalMessageStatus, user: User, channelId: string): Promise<void> {
        const prisma = db()

        try {
            // Fetch the approval message record
            const approvalMessage = await prisma.approval_slack_messages.findFirst({
                where: {
                    run_id: runId,
                    step_id: stepId
                }
            })

            if (!approvalMessage) {
                logger.debug(`[ApprovalService] No approval message found for runId: ${runId}, stepId: ${stepId}`)
                return
            }

            // Get cached summary or generate if missing
            let approvalSummary: string
            if (approvalMessage.summary) {
                approvalSummary = approvalMessage.summary
                logger.debug(`[ApprovalService] Using cached summary for runId: ${runId}, stepId: ${stepId}`)
            } else {
                // Fallback: generate summary if not cached (for existing records)
                logger.debug(`[ApprovalService] Summary not cached, generating for runId: ${runId}, stepId: ${stepId}`)

                const result = await generateApprovalSummary(runId, user, channelId, stepId)
                approvalSummary = result.approvalSummary

                // Store the generated summary for future use
                await prisma.approval_slack_messages.update({
                    where: { id: approvalMessage.id },
                    data: { summary: approvalSummary }
                })
            }

            // Get channel info for deep link
            const runRecord = await prisma.run_history_records.findUnique({
                where: { id: runId },
                include: { automation: true }
            })

            if (!runRecord?.automation) {
                logger.error(`[ApprovalService] Run record or automation not found for runId: ${runId}`)
                return
            }

            const channel = await prisma.automations.findUnique({
                where: { id: runRecord.automation.id }
            })

            if (!channel) {
                logger.error(`[ApprovalService] Channel not found for automation id: ${runRecord.automation.id}`)
                return
            }

            // Update Slack message
            const updateSuccess = await updateSlackApprovalMessage(
                approvalMessage.user_slack_integration_id,
                approvalMessage.slack_channel_id,
                approvalMessage.slack_message_ts,
                status,
                approvalSummary,
                channel.name,
                channel.id,
                runId,
                stepId
            )

            if (!updateSuccess) {
                logger.error(`[ApprovalService] Failed to update Slack message for runId: ${runId}, stepId: ${stepId}`)
                return
            }

            // Update database record status
            await prisma.approval_slack_messages.update({
                where: {
                    id: approvalMessage.id
                },
                data: {
                    status: status
                }
            })

            logger.info(`[ApprovalService] Successfully updated Slack notification to status: ${status} for runId: ${runId}, stepId: ${stepId}`)
        } catch (error) {
            logger.error(`[ApprovalService] Error updating Slack notification:`, { error, runId, stepId, status })
            // Don't throw - Slack notification failures shouldn't break approval processing
        }
    }

    static async processApproval(request: ApprovalRequest): Promise<ApprovalResult> {
        const { runId, stepId, approved, userId, organizationId, rejectionReason, hardReject } = request

        logger.info(`[ApprovalService] Processing approval for runId: ${runId}, stepId: ${stepId}, approved: ${approved}, hardReject: ${hardReject}`)

        // Keep minimal state outside the try so the catch can update Slack if we already flipped it to "processing".
        let channelIdForSlack: string | null = null
        let slackMarkedProcessing = false
        let user: User | null = null
        let channelForNotifications: AgentWithRelations | null = null

        try {
            // Validate organization access and load channel (inside try so failures are caught and run is marked failed)
            const { runRecord, channel } = await this.validateUserAccess(runId, organizationId)
            channelIdForSlack = channel.id
            channelForNotifications = channel

            // Create base session for AgentRunner (runtime User type)
            user = await getUserForOrg(userId, channel.organization_id)
            if (!user) {
                throw new Error(`User not found: ${userId}`)
            }

            // Store rejection reason in database if provided (for request changes flow)
            if (!approved && rejectionReason) {
                const prisma = db()
                await prisma.approval_slack_messages.updateMany({
                    where: {
                        run_id: runId,
                        step_id: stepId
                    },
                    data: {
                        rejection_reason: rejectionReason
                    }
                })
                logger.info(`[ApprovalService] Stored rejection reason for runId: ${runId}, stepId: ${stepId}`)
            }

            // Ensure run status is 'in_progress' for streaming
            if (runRecord.status !== RunHistoryStatus.IN_PROGRESS) {
                await markRunInProgress(runId)
            }

            // Update Slack notification to processing state
            await this.updateSlackNotification(runId, stepId, SlackApprovalMessageStatus.PROCESSING, user, channel.id)
            slackMarkedProcessing = true

            logger.info("[ApprovalFlow] Processing approval decision", { runId, stepId, decision: approved ? "approve" : "reject" })

            try {
                await appendToolApprovalResponseSystemEvent(runId, {
                    step_id: stepId,
                    approved,
                    rejection_reason: rejectionReason?.trim() || undefined
                })
            } catch (error) {
                logger.warn("[ApprovalService] Failed to append tool approval response system event to raw history", { runId, stepId, error })
            }

            emitCacheInvalidationWithWildcard(channel.organization_id, "runHistory", channel.id)
            emitCacheInvalidationWithKey(channel.organization_id, PENDING_APPROVALS_INVALIDATION_KEY)
            emitCacheInvalidationWithWildcard(channel.organization_id, "chatHistory", runId)

            // SDK runs: resolve the in-memory approval gate.
            // The SSE handler (handleSdkAgentRun) is awaiting waitForApprovalDecision() and will either
            // resume the agent (approve/soft-reject) or finalize the run as cancelled (hardReject).
            const finalSlackStatus = resolveSlackApprovalStatus(approved, hardReject, rejectionReason)

            resolveApprovalDecision(runId, stepId, channel.organization_id, {
                approved: !hardReject && approved,
                rejectionReason,
                hardReject: !!hardReject
            })

            await this.updateSlackNotification(runId, stepId, finalSlackStatus, user, channel.id)

            logger.info("[ApprovalService] SDK approval decision resolved via in-memory gate", { runId, stepId, approved, hardReject })
            return {
                status: ApprovalProcessingStatus.COMPLETED
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            logger.error(`[ApprovalService] Error processing approval: ${errorMessage}`, { error })

            // If we've already told Slack we're "processing", make sure we also tell Slack we failed.
            if (slackMarkedProcessing && channelIdForSlack && user) {
                await this.updateSlackNotification(runId, stepId, SlackApprovalMessageStatus.FAILED, user, channelIdForSlack)
            }

            try {
                await markRunFailed(runId, errorMessage, "agent")
                if (user && channelForNotifications) {
                    try {
                        await new NotificationManager(user, channelForNotifications).notifyRunFailure(runId, errorMessage)
                    } catch (notificationError) {
                        logger.error("[ApprovalService] Failed to send run failure notification", {
                            error: notificationError,
                            runId,
                            stepId,
                            channelId: channelForNotifications.id
                        })
                    }
                }
                // runHistory cache keys are scoped by channelId (not runId). chatHistory is scoped by runId.
                if (channelIdForSlack) {
                    const automation = await db().automations.findUnique({ where: { id: channelIdForSlack }, select: { organization_id: true } })
                    if (automation?.organization_id) {
                        emitCacheInvalidationWithWildcard(automation.organization_id, "runHistory", channelIdForSlack)
                        emitCacheInvalidationWithKey(automation.organization_id, PENDING_APPROVALS_INVALIDATION_KEY)
                    }
                } else {
                    logger.warn("[ApprovalService] Missing channel id; cannot invalidate runHistory cache", {
                        userId,
                        runId,
                        stepId
                    })
                }
            } catch (e) {
                logger.error("Failed to mark run as failed", { error: e })
            }

            return {
                status: ApprovalProcessingStatus.FAILED,
                error: errorMessage
            }
        }
    }
}

function resolveSlackApprovalStatus(approved: boolean, hardReject?: boolean, rejectionReason?: string): SlackApprovalMessageStatus {
    if (approved) return SlackApprovalMessageStatus.APPROVED
    if (hardReject) return SlackApprovalMessageStatus.REJECTED
    if (rejectionReason) return SlackApprovalMessageStatus.CHANGES_REQUESTED
    return SlackApprovalMessageStatus.REJECTED
}

type ApprovalRequest = {
    runId: string
    stepId: string
    approved: boolean
    userId: string
    organizationId: string
    rejectionReason?: string
    /** When true, finalizes the run as cancelled in the SSE handler instead of resuming the agent. */
    hardReject?: boolean
}

type ApprovalResult = {
    // 'completed' means the run finished after applying this approval decision.
    // 'awaiting_approval' means this approval decision was processed successfully, but the agent requested another approval (chained approvals).
    status: ApprovalProcessingStatus
    result?: {
        finalOutput?: unknown
    }
    error?: string
}

export enum ApprovalProcessingStatus {
    COMPLETED = "completed",
    AWAITING_APPROVAL = "awaiting_approval",
    FAILED = "failed"
}

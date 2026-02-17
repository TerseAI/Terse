import { RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"

import { AgentRunResultStatus, AgentRunner } from "../agent/AgentRunner/AgentRunner"
import { evaluateCompletedRun, finalizeRunStatus, markRunFailed, markRunInProgress } from "../agent/AgentRunner/runHistory"
import { generateApprovalSummary } from "../agent/ApprovalSummaryAgent/ApprovalSummaryAgent"
import { appendToolApprovalResponseMarker } from "../agent/approvalMarkers"
import { KnowledgeBase } from "../knowledgeBase/abstract/KnowledgeBase"
import { KnowledgeBaseFactory } from "../knowledgeBase/abstract/KnowledgeBaseFactory"
import logger from "../logger"
import { NotificationManager } from "../notifications/Notification"
import { Output } from "../outputs/abstract/Output"
import { OutputFactory } from "../outputs/abstract/OutputFactory"
import { db } from "../prismaClient"
import { ConfigInstance } from "../shared/Configs"
import { ModelEvent } from "../shared/ModelEvents"
import { type RunHistoryModelEvent, type RunHistoryModelSocketEvent, RunHistoryStatus } from "../shared/RunHistoryTypes"
import { SocketEvents, SocketRooms } from "../shared/SocketEvents"
import { User } from "../shared/types"
import { SlackApprovalMessageStatus } from "../slack/ApprovalStatus"
import { AgentWithRelations } from "../types/prisma"
import { Session } from "../types/session"
import { getInputConfigInclude, getKnowledgeBaseConfigInclude, getOutputConfigInclude } from "../utility/prismaIncludes"
import { updateSlackApprovalMessage } from "../utility/slack"
import { randomString } from "../utility/strings"
import { getUserForOrg } from "../utility/workos"

import { emitCacheInvalidationWithWildcard, getSocketIO } from "./CacheInvalidationService"

export type ApprovalRequest = {
    runId: string
    stepId: string
    approved: boolean
    userId: string
    organizationId: string
    rejectionReason?: string
    /** When true, stops the run completely without resuming the agent */
    hardReject?: boolean
}

export type ApprovalResult = {
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
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude()
                },
                tool_approvals: true
            }
        })

        if (!channel) {
            throw new Error(`Channel not found for automation id: ${runRecord.automation.id}`)
        }

        return { runRecord, channel }
    }

    private static createOutputs(channel: AgentWithRelations): Output<ConfigInstance>[] {
        return OutputFactory.createOutputsFromAgent(channel)
    }

    private static createKnowledgeBases(channelKnowledgeBases: AgentWithRelations["knowledge_bases"]): KnowledgeBase<ConfigInstance>[] {
        return KnowledgeBaseFactory.createKnowledgeBasesFromAgent(channelKnowledgeBases)
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

            // Create outputs
            const outputs = this.createOutputs(channel)

            const session: Session = {
                user,
                isUserInitiated: true
            }

            // Create knowledge bases from agent configuration
            const knowledgeBases = this.createKnowledgeBases(channel.knowledge_bases || [])

            // Ensure run status is 'in_progress' for streaming
            if (runRecord.status !== RunHistoryStatus.IN_PROGRESS) {
                await markRunInProgress(runId)
            }

            // Update Slack notification to processing state
            await this.updateSlackNotification(runId, stepId, SlackApprovalMessageStatus.PROCESSING, user, channel.id)
            slackMarkedProcessing = true

            // Store the approval response event
            const toolApprovalResponseEvent: ModelEvent = {
                type: "ToolApprovalResponse",
                step_id: stepId,
                approved: approved
            }

            try {
                await appendToolApprovalResponseMarker(runId, {
                    step_id: stepId,
                    approved
                })
            } catch (error) {
                logger.warn("[ApprovalService] Failed to append tool approval response marker to raw history", { runId, stepId, error })
            }

            const io = getSocketIO()
            if (io && channel.organization_id) {
                const runHistoryModelEvent: RunHistoryModelEvent = {
                    ...toolApprovalResponseEvent,
                    id: `approval-response-live-${randomString(15)}`,
                    timestamp: Date.now()
                }
                const payload: RunHistoryModelSocketEvent = {
                    runId,
                    agentId: channel.id,
                    runHistoryModelEvent
                }
                io.to(SocketRooms.organization(channel.organization_id)).emit(SocketEvents.AGENT_CHAT_EVENT, payload)
            }

            emitCacheInvalidationWithWildcard(channel.organization_id, "runHistory", channel.id)
            emitCacheInvalidationWithWildcard(channel.organization_id, "chatHistory", runId)

            // Create agent runner and resume from pending approval
            const runContext = { runId }
            const agentRunner = new AgentRunner(session, outputs, knowledgeBases, channel, runContext)
            await agentRunner.initializeAgent()

            const decision: "approve" | "reject" = approved ? "approve" : "reject"
            const result = await agentRunner.resumeFromPendingApproval(
                decision,
                stepId,
                {
                    runId,
                    user: user,
                    agentId: channel.id
                },
                rejectionReason,
                hardReject
            )

            // Use 'changes_requested' for request changes flow (rejected with feedback), 'rejected' for hard reject
            const finalSlackStatus = approved
                ? SlackApprovalMessageStatus.APPROVED
                : hardReject
                  ? SlackApprovalMessageStatus.REJECTED
                  : rejectionReason
                    ? SlackApprovalMessageStatus.CHANGES_REQUESTED
                    : SlackApprovalMessageStatus.REJECTED

            // Finalize run status based on result
            if (result.status === AgentRunResultStatus.COMPLETED) {
                const completion = evaluateCompletedRun(result.result?.finalOutput, result.endedWithToolFailure)
                try {
                    await finalizeRunStatus(runId, completion.status)
                    emitCacheInvalidationWithWildcard(channel.organization_id, "runHistory", channel.id)
                    if (!completion.isSuccessful) {
                        try {
                            await new NotificationManager(user, channel).notifyRunFailure(runId, completion.failureReason)
                        } catch (notificationError) {
                            logger.error("[ApprovalService] Failed to send run failure notification", {
                                error: notificationError,
                                runId,
                                stepId,
                                channelId: channel.id
                            })
                        }
                    }
                } catch (e) {
                    logger.error("Failed to finalize run status", { error: e })
                }

                // Update Slack notification to final approved/rejected state
                await this.updateSlackNotification(runId, stepId, finalSlackStatus, user, channel.id)

                logger.info(`[ApprovalService] Successfully processed approval for runId: ${runId}, stepId: ${stepId}`)
                return {
                    status: ApprovalProcessingStatus.COMPLETED,
                    result: result.result
                }
            }

            if (result.status === AgentRunResultStatus.AWAITING_APPROVAL) {
                await this.updateSlackNotification(runId, stepId, finalSlackStatus, user, channel.id)

                emitCacheInvalidationWithWildcard(channel.organization_id, "runHistory", channel.id)
                emitCacheInvalidationWithWildcard(channel.organization_id, "chatHistory", runId)

                logger.info(`[ApprovalService] Processed approval decision; run is now awaiting another approval`, { runId, stepId, approved })

                return {
                    status: ApprovalProcessingStatus.AWAITING_APPROVAL
                }
            }

            // Defensive fallback: unknown status from AgentRunner
            logger.warn(`[ApprovalService] Unexpected agent status after resuming approval`, {
                runId,
                stepId,
                status: (result as any)?.status
            })
            await this.updateSlackNotification(runId, stepId, finalSlackStatus, user, channel.id)
            return {
                status: ApprovalProcessingStatus.FAILED,
                error: `Unexpected agent status after resuming: ${(result as any)?.status ?? "unknown"}`
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

import { getUserForOrg } from "../routes/auth";
import { db } from "../prismaClient";
import { AgentWithRelations } from "../types/prisma";
import { getInputConfigInclude, getOutputConfigInclude, getKnowledgeBaseConfigInclude } from "../utility/prismaIncludes";
import { OutputFactory } from "../outputs/abstract/OutputFactory";
import { Output } from "../outputs/abstract/Output";
import { KnowledgeBaseFactory } from "../knowledgeBase/abstract/KnowledgeBaseFactory";
import { KnowledgeBase } from "../knowledgeBase/abstract/KnowledgeBase";
import { ConfigInstance } from "../shared/Configs";
import { Session } from "../server";
import { storeChatEvent, markRunFailed, finalizeRunStatus, markRunInProgress } from "../agent/AgentRunner/runHistory";
import { AgentRunner } from "../agent/AgentRunner/AgentRunner";
import { ModelEvent } from "../shared/ModelEvents";
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket";
import { updateSlackApprovalMessage } from "../utility/slack";
import { generateApprovalSummary } from "../agent/ApprovalSummaryAgent/ApprovalSummaryAgent";
import logger from "../logger";

export type ApprovalRequest = {
    runId: string;
    stepId: string;
    approved: boolean;
    userId: string;
    rejectionReason?: string;
    /** When true, stops the run completely without resuming the agent */
    hardReject?: boolean;
};

export type ApprovalResult = {
    // 'completed' means the run finished after applying this approval decision.
    // 'awaiting_approval' means this approval decision was processed successfully, but the agent requested another approval (chained approvals).
    status: 'completed' | 'awaiting_approval' | 'failed';
    result?: {
        finalOutput?: unknown;
    };
    error?: string;
};


export class ApprovalService {
    private static async validateUserAccess(runId: string, userId: string): Promise<{
        runRecord: { id: string; status: string; automation: { id: string; user_id: string } };
        channel: AgentWithRelations;
    }> {
        const prisma = db();
        
        const runRecord = await prisma.run_history_records.findUnique({
            where: { id: runId },
            include: { automation: true },
        });

        if (!runRecord || !runRecord.automation || runRecord.automation.user_id !== userId) {
            throw new Error(`User ${userId} does not have access to run ${runId}`);
        }

        const channel = await prisma.automations.findUnique({
            where: {
                id: runRecord.automation.id,
                user_id: userId,
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude(),
                },
                outputs: {
                    include: getOutputConfigInclude(),
                },
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude(),
                },
                tool_approvals: true,
            },
        });

        if (!channel) {
            throw new Error(`Channel not found for automation id: ${runRecord.automation.id}`);
        }

        return { runRecord, channel };
    }

    private static createOutputs(
        channel: AgentWithRelations
    ): Output<ConfigInstance>[] {
        return OutputFactory.createOutputsFromAgent(channel);
    }

    private static createKnowledgeBases(
        channelKnowledgeBases: AgentWithRelations['knowledge_bases']
    ): KnowledgeBase<ConfigInstance>[] {
        return KnowledgeBaseFactory.createKnowledgeBasesFromAgent(channelKnowledgeBases);
    }

    /**
     * Updates Slack notification for an approval request.
     * Handles fetching approval message, cached summary, channel info, and updating both Slack message and database.
     */
    private static async updateSlackNotification(
        runId: string,
        stepId: string,
        status: 'processing' | 'approved' | 'rejected' | 'changes_requested' | 'failed',
        userId: string,
        channelId: string
    ): Promise<void> {
        const prisma = db();

        try {
            // Fetch the approval message record
            const approvalMessage = await prisma.approval_slack_messages.findFirst({
                where: {
                    run_id: runId,
                    step_id: stepId,
                },
            });

            if (!approvalMessage) {
                logger.debug(`[ApprovalService] No approval message found for runId: ${runId}, stepId: ${stepId}`);
                return;
            }

            // Get cached summary or generate if missing
            let approvalSummary: string;
            if (approvalMessage.summary) {
                approvalSummary = approvalMessage.summary;
                logger.debug(`[ApprovalService] Using cached summary for runId: ${runId}, stepId: ${stepId}`);
            } else {
                // Fallback: generate summary if not cached (for existing records)
                logger.debug(`[ApprovalService] Summary not cached, generating for runId: ${runId}, stepId: ${stepId}`);
                
                const result = await generateApprovalSummary(
                    runId,
                    userId,
                    channelId,
                    stepId
                );
                approvalSummary = result.approvalSummary;

                // Store the generated summary for future use
                await prisma.approval_slack_messages.update({
                    where: { id: approvalMessage.id },
                    data: { summary: approvalSummary },
                });
            }

            // Get channel info for deep link
            const runRecord = await prisma.run_history_records.findUnique({
                where: { id: runId },
                include: { automation: true },
            });

            if (!runRecord?.automation) {
                logger.error(`[ApprovalService] Run record or automation not found for runId: ${runId}`);
                return;
            }

            const channel = await prisma.automations.findUnique({
                where: { id: runRecord.automation.id },
            });

            if (!channel) {
                logger.error(`[ApprovalService] Channel not found for automation id: ${runRecord.automation.id}`);
                return;
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
            );

            if (!updateSuccess) {
                logger.error(`[ApprovalService] Failed to update Slack message for runId: ${runId}, stepId: ${stepId}`);
                return;
            }

            // Update database record status
            await prisma.approval_slack_messages.update({
                where: {
                    id: approvalMessage.id,
                },
                data: {
                    status: status,
                },
            });

            logger.info(`[ApprovalService] Successfully updated Slack notification to status: ${status} for runId: ${runId}, stepId: ${stepId}`);
        } catch (error) {
            logger.error(`[ApprovalService] Error updating Slack notification:`, { error, runId, stepId, status });
            // Don't throw - Slack notification failures shouldn't break approval processing
        }
    }

    static async processApproval(request: ApprovalRequest): Promise<ApprovalResult> {
        const { runId, stepId, approved, userId, rejectionReason, hardReject } = request;

        logger.info(`[ApprovalService] Processing approval for runId: ${runId}, stepId: ${stepId}, approved: ${approved}, hardReject: ${hardReject}`);

        // Keep minimal state outside the try so the catch can update Slack if we already flipped it to "processing".
        let channelIdForSlack: string | null = null;
        let slackMarkedProcessing = false;
        try {
            // Validate user access and load channel
            const { runRecord, channel } = await this.validateUserAccess(runId, userId);
            channelIdForSlack = channel.id;

            // Store rejection reason in database if provided (for request changes flow)
            if (!approved && rejectionReason) {
                const prisma = db();
                await prisma.approval_slack_messages.updateMany({
                    where: {
                        run_id: runId,
                        step_id: stepId,
                    },
                    data: {
                        rejection_reason: rejectionReason,
                    },
                });
                logger.info(`[ApprovalService] Stored rejection reason for runId: ${runId}, stepId: ${stepId}`);
            }

            // Create outputs
            const outputs = this.createOutputs(channel);

            // Create base session for AgentRunner (runtime User type)
            const user = await getUserForOrg(userId, channel.organization_id);
            if (!user) {
                throw new Error(`User not found: ${userId}`);
            }

            const session: Session = {
                user,
                isUserInitiated: true,
            };

            // Create knowledge bases from agent configuration
            const knowledgeBases = this.createKnowledgeBases(channel.knowledge_bases || []);

            // Ensure run status is 'in_progress' for streaming
            if (runRecord.status !== 'in_progress') {
                await markRunInProgress(runId);
            }

            // Update Slack notification to processing state
            await this.updateSlackNotification(runId, stepId, 'processing', userId, channel.id);
            slackMarkedProcessing = true;

            // Store the approval response event
            const toolApprovalResponseEvent: ModelEvent = {
                type: 'ToolApprovalResponse',
                step_id: stepId,
                approved: approved,
            };
            await storeChatEvent(runId, toolApprovalResponseEvent);
            emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
            emitCacheInvalidationWithWildcard(userId, 'chatHistory', runId);

            // Create agent runner and resume from pending approval
            const runContext = { runId };
            const agentRunner = new AgentRunner(session, outputs, knowledgeBases, channel, runContext);
            await agentRunner.initializeAgent();

            const decision: 'approve' | 'reject' = approved ? 'approve' : 'reject';
            const result = await agentRunner.resumeFromPendingApproval(
                decision,
                stepId,
                {
                    runId,
                    userId: userId,
                    agentId: channel.id,
                },
                rejectionReason,
                hardReject
            );

            // Use 'changes_requested' for request changes flow (rejected with feedback), 'rejected' for hard reject
            const finalSlackStatus = approved ? 'approved' : (hardReject ? 'rejected' : (rejectionReason ? 'changes_requested' : 'rejected'));

            // Finalize run status based on result
            if (result.status === 'completed') {
                const hasFinalOutput = Boolean(result.result?.finalOutput);
                try {
                    await finalizeRunStatus(runId, hasFinalOutput ? 'success' : 'failed');
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
                } catch (e) {
                    logger.error('Failed to finalize run status', { error: e });
                }

                // Update Slack notification to final approved/rejected state
                await this.updateSlackNotification(runId, stepId, finalSlackStatus, userId, channel.id);

                logger.info(`[ApprovalService] Successfully processed approval for runId: ${runId}, stepId: ${stepId}`);
                return {
                    status: 'completed' as const,
                    result: result.result,
                };
            }

            if (result.status === 'awaiting_approval') {
                await this.updateSlackNotification(runId, stepId, finalSlackStatus, userId, channel.id);

                emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
                emitCacheInvalidationWithWildcard(userId, 'chatHistory', runId);

                logger.info(
                    `[ApprovalService] Processed approval decision; run is now awaiting another approval`,
                    { runId, stepId, approved }
                );

                return {
                    status: 'awaiting_approval' as const,
                };
            }

            // Defensive fallback: unknown status from AgentRunner
            logger.warn(`[ApprovalService] Unexpected agent status after resuming approval`, {
                runId,
                stepId,
                status: (result as any)?.status,
            });
            await this.updateSlackNotification(runId, stepId, finalSlackStatus, userId, channel.id);
            return {
                status: 'failed' as const,
                error: `Unexpected agent status after resuming: ${(result as any)?.status ?? 'unknown'}`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[ApprovalService] Error processing approval: ${errorMessage}`, { error });

            // If we've already told Slack we're "processing", make sure we also tell Slack we failed.
            if (slackMarkedProcessing && channelIdForSlack) {
                await this.updateSlackNotification(runId, stepId, 'failed', userId, channelIdForSlack);
            }

            try {
                await markRunFailed(runId, errorMessage, 'agent');
                // runHistory cache keys are scoped by channelId (not runId). chatHistory is scoped by runId.
                if (channelIdForSlack) {
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', channelIdForSlack);
                } else {
                    logger.warn('[ApprovalService] Missing channel id; cannot invalidate runHistory cache', {
                        userId,
                        runId,
                        stepId,
                    });
                }
            } catch (e) {
                logger.error('Failed to mark run as failed', { error: e });
            }

            return {
                status: 'failed',
                error: errorMessage,
            };
        }
    }
}


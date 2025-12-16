import { db } from "../prismaClient";
import { ChannelWithRelations } from "../types/prisma";
import { getInputConfigInclude, getOutputConfigInclude } from "../utility/prismaIncludes";
import { OutputFactory } from "../outputs/abstract/OutputFactory";
import { Session } from "../server";
import { storeChatEvent, markRunFailed, finalizeRunStatus, markRunInProgress } from "../agent/ChannelAgent/runHistory";
import { ChannelAgent } from "../agent/ChannelAgent/ChannelAgent";
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
};

export type ApprovalResult = {
    status: 'completed' | 'failed';
    result?: {
        finalOutput?: unknown;
    };
    error?: string;
};


export class ApprovalService {
    private static async validateUserAccess(runId: string, userId: string): Promise<{
        runRecord: { id: string; status: string; automation: { id: string; user_id: string } };
        channel: ChannelWithRelations;
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
                output: {
                    include: getOutputConfigInclude(),
                },
            },
        }) as ChannelWithRelations | null;

        if (!channel) {
            throw new Error(`Channel not found for automation id: ${runRecord.automation.id}`);
        }

        return { runRecord, channel };
    }

    private static async createOutputAndSession(
        channel: ChannelWithRelations,
        userId: string
    ): Promise<{ output: ReturnType<typeof OutputFactory.createOutput>; session: Session }> {
        const prisma = db();
        
        const outputIntegration = channel.output;
        if (!outputIntegration) {
            throw new Error(`No output integration found for channel: ${channel.id}`);
        }

        const output = OutputFactory.createOutput(outputIntegration.config_type);
        if (!output) {
            throw new Error(`Output type ${outputIntegration.config_type} is not supported`);
        }

        const user = await prisma.users.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new Error(`User not found for userId: ${userId}`);
        }

        let session: Session;
        try {
            session = await output.createSessionFromConfig(
                outputIntegration.integration_id,
                outputIntegration,
                user
            );
        } catch (error) {
            throw new Error(`Failed to create session: ${error}`);
        }

        return { output, session };
    }

    /**
     * Updates Slack notification for an approval request.
     * Handles fetching approval message, cached summary, channel info, and updating both Slack message and database.
     */
    private static async updateSlackNotification(
        runId: string,
        stepId: string,
        status: 'processing' | 'approved' | 'rejected',
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
                runId
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
        const { runId, stepId, approved, userId } = request;

        logger.info(`[ApprovalService] Processing approval for runId: ${runId}, stepId: ${stepId}, approved: ${approved}`);
        try {
            // Validate user access and load channel
            const { runRecord, channel } = await this.validateUserAccess(runId, userId);

            // Create output and session
            const outputAndSession = await this.createOutputAndSession(channel, userId);
            if (!outputAndSession.output) {
                throw new Error(`Output type not supported`);
            }
            const { output, session } = outputAndSession;

            // Ensure run status is 'in_progress' for streaming
            if (runRecord.status !== 'in_progress') {
                await markRunInProgress(runId);
            }

            // Update Slack notification to processing state
            await this.updateSlackNotification(runId, stepId, 'processing', userId, channel.id);

            // Store the approval response event
            const toolApprovalResponseEvent: ModelEvent = {
                type: 'ToolApprovalResponse',
                step_id: stepId,
                approved: approved,
            };
            await storeChatEvent(runId, toolApprovalResponseEvent);
            emitCacheInvalidationWithWildcard(userId, 'runHistory', channel.id);
            emitCacheInvalidationWithWildcard(userId, 'chatHistory', runId);

            // Create channel agent and resume from pending approval
            const runContext = { runId };
            const channelAgent = new ChannelAgent(session, output, channel, runContext);
            await channelAgent.initializeAgent();

            const decision: 'approve' | 'reject' = approved ? 'approve' : 'reject';
            const result = await channelAgent.resumeFromPendingApproval(
                decision,
                stepId,
                {
                    runId,
                    userId: userId,
                    channelId: channel.id,
                }
            );

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
                const finalStatus = approved ? 'approved' : 'rejected';
                await this.updateSlackNotification(runId, stepId, finalStatus, userId, channel.id);

                logger.info(`[ApprovalService] Successfully processed approval for runId: ${runId}, stepId: ${stepId}`);
                return {
                    status: 'completed' as const,
                    result: result.result,
                };
            } else {
                // If status is 'awaiting_approval', something went wrong - we should have completed
                // This shouldn't happen after resuming from pending approval, but handle it gracefully
                logger.warn(`[ApprovalService] Unexpected awaiting_approval status after resuming approval for runId: ${runId}`);
                
                // Update Slack notification to rejected state since it failed
                await this.updateSlackNotification(runId, stepId, 'rejected', userId, channel.id);
                
                return {
                    status: 'failed' as const,
                    error: 'Unexpected awaiting_approval status after resuming',
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[ApprovalService] Error processing approval: ${errorMessage}`, { error });

            try {
                await markRunFailed(runId, errorMessage, 'agent');
                emitCacheInvalidationWithWildcard(userId, 'runHistory', runId);
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


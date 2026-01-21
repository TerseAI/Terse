import { db } from "../prismaClient";
import { AgentWithRelations, AgentKnowledgeBaseWithConfigs } from "../types/prisma";
import { getInputConfigInclude, getOutputConfigInclude, getKnowledgeBaseConfigInclude } from "../utility/prismaIncludes";
import { OutputFactory } from "../outputs/abstract/OutputFactory";
import { KnowledgeBaseFactory } from "../knowledgeBase/abstract/KnowledgeBaseFactory";
import { KnowledgeBase } from "../knowledgeBase/abstract/KnowledgeBase";
import { ConfigInstance } from "../shared/Configs";
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
        agent: AgentWithRelations;
    }> {
        const prisma = db();
        
        const runRecord = await prisma.run_history_records.findUnique({
            where: { id: runId },
            include: { automation: true },
        });

        if (!runRecord || !runRecord.automation || runRecord.automation.user_id !== userId) {
            throw new Error(`User ${userId} does not have access to run ${runId}`);
        }

        const agent = await prisma.automations.findUnique({
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
                knowledge_bases: {
                    include: getKnowledgeBaseConfigInclude(),
                },
            },
        })

        if (!agent) {
            throw new Error(`Agent not found for automation id: ${runRecord.automation.id}`);
        }

        return { runRecord, agent };
    }

    private static async createOutputAndSession(
        agent: AgentWithRelations,
        userId: string
    ): Promise<{ output: ReturnType<typeof OutputFactory.createOutput>; session: Session }> {
        const prisma = db();
        
        const outputIntegration = agent.output;
        if (!outputIntegration) {
            throw new Error(`No output integration found for agent: ${agent.id}`);
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

    private static createKnowledgeBases(
        agentKnowledgeBases: AgentWithRelations['knowledge_bases']
    ): { knowledgeBases: KnowledgeBase<Session, ConfigInstance>[]; agentConfigs: AgentKnowledgeBaseWithConfigs[] } {
        if (!agentKnowledgeBases || agentKnowledgeBases.length === 0) {
            return { knowledgeBases: [], agentConfigs: [] };
        }

        // Create knowledge base instances and maintain pairing with agent configs
        const knowledgeBases: KnowledgeBase<Session, ConfigInstance>[] = [];
        const agentConfigs: AgentKnowledgeBaseWithConfigs[] = [];
        
        for (const agentKnowledgeBase of agentKnowledgeBases) {
            const kb = KnowledgeBaseFactory.createKnowledgeBase(agentKnowledgeBase.config_type);
            if (kb) {
                knowledgeBases.push(kb);
                agentConfigs.push(agentKnowledgeBase as AgentKnowledgeBaseWithConfigs);
            }
        }
        
        return { knowledgeBases, agentConfigs };
    }

    /**
     * Updates Slack notification for an approval request.
     * Handles fetching approval message, cached summary, agent info, and updating both Slack message and database.
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

            // Get agent info for deep link
            const runRecord = await prisma.run_history_records.findUnique({
                where: { id: runId },
                include: { automation: true },
            });

            if (!runRecord?.automation) {
                logger.error(`[ApprovalService] Run record or automation not found for runId: ${runId}`);
                return;
            }

            const agent = await prisma.automations.findUnique({
                where: { id: runRecord.automation.id },
            });

            if (!agent) {
                logger.error(`[ApprovalService] Agent not found for automation id: ${runRecord.automation.id}`);
                return;
            }

            // Update Slack message
            const updateSuccess = await updateSlackApprovalMessage(
                approvalMessage.user_slack_integration_id,
                approvalMessage.slack_channel_id,
                approvalMessage.slack_message_ts,
                status,
                approvalSummary,
                agent.name,
                agent.id,
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
        let agentIdForSlack: string | null = null;
        let slackMarkedProcessing = false;
        try {
            // Validate user access and load agent
            const { runRecord, agent } = await this.validateUserAccess(runId, userId);
            agentIdForSlack = agent.id;

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

            // Create output and session
            const outputAndSession = await this.createOutputAndSession(agent, userId);
            if (!outputAndSession.output) {
                throw new Error(`Output type not supported`);
            }
            const { output, session } = outputAndSession;

            // Create knowledge bases from agent configuration
            const { knowledgeBases, agentConfigs } = this.createKnowledgeBases(agent.knowledge_bases || []);

            // Ensure run status is 'in_progress' for streaming
            if (runRecord.status !== 'in_progress') {
                await markRunInProgress(runId);
            }

            // Update Slack notification to processing state
            await this.updateSlackNotification(runId, stepId, 'processing', userId, agent.id);
            slackMarkedProcessing = true;

            // Store the approval response event
            const toolApprovalResponseEvent: ModelEvent = {
                type: 'ToolApprovalResponse',
                step_id: stepId,
                approved: approved,
            };
            await storeChatEvent(runId, toolApprovalResponseEvent);
            emitCacheInvalidationWithWildcard(userId, 'runHistory', agent.id);
            emitCacheInvalidationWithWildcard(userId, 'chatHistory', runId);

            // Create agent and resume from pending approval
            const runContext = { runId };
            const channelAgent = new ChannelAgent(session, output, knowledgeBases, agentConfigs, agent, runContext);
            await channelAgent.initializeAgent();

            const decision: 'approve' | 'reject' = approved ? 'approve' : 'reject';
            const result = await channelAgent.resumeFromPendingApproval(
                decision,
                stepId,
                {
                    runId,
                    userId: userId,
                    agentId: agent.id,
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
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', agent.id);
                } catch (e) {
                    logger.error('Failed to finalize run status', { error: e });
                }

                // Update Slack notification to final approved/rejected state
                await this.updateSlackNotification(runId, stepId, finalSlackStatus, userId, agent.id);

                logger.info(`[ApprovalService] Successfully processed approval for runId: ${runId}, stepId: ${stepId}`);
                return {
                    status: 'completed' as const,
                    result: result.result,
                };
            }

            if (result.status === 'awaiting_approval') {
                await this.updateSlackNotification(runId, stepId, finalSlackStatus, userId, agent.id);

                emitCacheInvalidationWithWildcard(userId, 'runHistory', agent.id);
                emitCacheInvalidationWithWildcard(userId, 'chatHistory', runId);

                logger.info(
                    `[ApprovalService] Processed approval decision; run is now awaiting another approval`,
                    { runId, stepId, approved }
                );

                return {
                    status: 'awaiting_approval' as const,
                };
            }

            // Defensive fallback: unknown status from ChannelAgent
            logger.warn(`[ApprovalService] Unexpected agent status after resuming approval`, {
                runId,
                stepId,
                status: (result as any)?.status,
            });
            await this.updateSlackNotification(runId, stepId, finalSlackStatus, userId, agent.id);
            return {
                status: 'failed' as const,
                error: `Unexpected agent status after resuming: ${(result as any)?.status ?? 'unknown'}`,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`[ApprovalService] Error processing approval: ${errorMessage}`, { error });

            // If we've already told Slack we're "processing", make sure we also tell Slack we failed.
            if (slackMarkedProcessing && agentIdForSlack) {
                await this.updateSlackNotification(runId, stepId, 'failed', userId, agentIdForSlack);
            }

            try {
                await markRunFailed(runId, errorMessage, 'agent');
                // runHistory cache keys are scoped by agentId (not runId). chatHistory is scoped by runId.
                if (agentIdForSlack) {
                    emitCacheInvalidationWithWildcard(userId, 'runHistory', agentIdForSlack);
                } else {
                    logger.warn('[ApprovalService] Missing agent id; cannot invalidate runHistory cache', {
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


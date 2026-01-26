import { db } from '../../prismaClient';
import { Agent as PrismaAgent, AgentWithRelations, User } from '../../types/prisma';
import { InputEvent } from '../../integrations/abstract/InputEvent';
import { SessionWithTracking, ApprovalResult } from './AgentRunner';
import { filterEvent } from './EventFilter';
import { createRunRecord, finalizeRunStatus, markRunFailed, markRunProcessed, markRunSkipped, appendRunAction } from './runHistory';
import { Agent as OpenAIAgent, AgentOutputType, RunResult } from '@openai/agents';
import { Session } from '../../types/session';
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from '../../services/CacheInvalidationService';
import { getAgentHydrationInclude } from '../../utility/prismaIncludes';
import { hydrateAgentFromRecord, createAgentRunner, formatHydrationError } from './AgentHydration';
import { RunHistoryAction } from '../../shared/RunHistoryTypes';
import { RunContext } from './SystemPromptBuilder';
import logger from '../../logger';

// The job of this class is to take an Input Event, and check if it's a match for an Agent.
// It will then create a Session, and summon the Agent Runner with the create user data.

export class ProcessorResult<T extends Session = SessionWithTracking<Session>> {
    success: boolean;
    message: string;
    agentConfig: PrismaAgent | null;
    approvalResult?: ApprovalResult<SessionWithTracking<T>, OpenAIAgent<SessionWithTracking<T>, AgentOutputType>> | null;

    constructor(success: boolean, message: string, agentConfig: PrismaAgent | null, approvalResult?: ApprovalResult<SessionWithTracking<T>, OpenAIAgent<SessionWithTracking<T>, AgentOutputType>> | null) {
        this.success = success;
        this.message = message;
        this.agentConfig = agentConfig;
        this.approvalResult = approvalResult;
    }
}

export class EventProcessor {
    private inputEvent: InputEvent;
    private user: User;

    constructor(inputEvent: InputEvent, user: User) {
        this.inputEvent = inputEvent;
        this.user = user;
    }

    async process(): Promise<ProcessorResult[]> {
        logger.info(`Processing input event: ${this.inputEvent.debugLog()}`);

        const results: ProcessorResult[] = [];

        // Get integration type from event itself (no hardcoded checks)
        const integrationType = this.inputEvent.integrationType;

        // Find all active agents for this user (already includes all config relations)
        const agents: AgentWithRelations[] = await db().automations.findMany({
            where: {
                user_id: this.user.id,
                is_active: true,
            },
            include: getAgentHydrationInclude()
        })

        if (agents.length === 0) {
            return [new ProcessorResult(false, "No agents found for this user", null)];
        }

        // Filter agents using event's own filtering method
        // Each event type handles its own matching logic (no switch statements)
        const matchingAgents = agents.filter(agent =>
            agent.inputs.some(input => this.inputEvent.matchesAgentTrigger(input))
        );

        if (matchingAgents.length === 0) {
            return [new ProcessorResult(false, `No agents match this ${integrationType} event`, null)];
        }

        logger.info(`Found ${matchingAgents.length} matching agent(s) for ${integrationType} event`);

        // Process each matching agent
        for (const agent of matchingAgents) {
            try {
                const result = await this.processAgent(agent);
                results.push(result);
            } catch (error) {
                logger.error(`Error processing agent ${agent.id}`, { error, agentId: agent.id, agentName: agent.name });
                results.push(new ProcessorResult(
                    false,
                    `Error processing agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    agent
                ));
            }
        }

        return results;
    }

    private async processAgent(agent: AgentWithRelations): Promise<ProcessorResult> {
        logger.info(`Processing agent: ${agent.name} (${agent.id})`);

        if (!agent.prompt) {
            return new ProcessorResult(false, "No prompt found for this agent", agent);
        }

        // Initialize run history record with trigger details
        const trigger = this.inputEvent.createTriggerMetadata();
        const runId = await createRunRecord({
            agentId: agent.id,
            trigger,
        });
        emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', agent.id);
        emitCacheInvalidationWithKey(this.user.id, 'recentAgents');

        // Hydrate agent with outputs, knowledge bases, and session
        const hydrationResult = await hydrateAgentFromRecord(agent, this.user.id);
        if (!hydrationResult.success) {
            const errorMessage = formatHydrationError(hydrationResult.error);
            return new ProcessorResult(false, errorMessage, agent);
        }

        const { session } = hydrationResult.data;

        // Filter the event using AI to see if it's relevant to this agent
        let filterResult;
        try {
            const filterResponse = await filterEvent(
                this.inputEvent,
                agent.prompt,
                {
                    runId,
                    userId: this.user.id,
                    agentId: agent.id,
                }
            );

            filterResult = filterResponse.result;
        } catch (error) {
            // Log the error and update run history
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Error filtering event for agent "${agent.name}"`, { error, agentId: agent.id, agentName: agent.name, runId });

            try {
                await markRunFailed(runId, errorMessage, 'filter');
                emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', agent.id);
            } catch (e) {
                logger.error('Failed to mark run as failed', { error: e, runId, agentId: agent.id });
            }

            return new ProcessorResult(
                false,
                `Error during filtering: ${errorMessage}`,
                agent
            );
        }

        if (!filterResult.isRelevant) {
            logger.info(`Event is not relevant to agent "${agent.name}": ${filterResult.reason}`);
            try {
                await markRunSkipped(runId, filterResult.reason);
                // Emit cache invalidation to update UI
                emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', agent.id);
            } catch (e) {
                logger.error('Failed to mark run skipped', { error: e, runId, agentId: agent.id });
            }
            return new ProcessorResult(false, `Not relevant: ${filterResult.reason}`, agent);
        }

        try {
            await markRunProcessed(runId, filterResult.reason);
        } catch (e) {
            logger.error('Failed to mark run processed', { error: e, runId, agentId: agent.id });
        }

        logger.info(`Event is relevant to agent "${agent.name}"`);

        // Create agent runner with hydrated dependencies
        const runContext: RunContext = { runId };
        const agentRunner = createAgentRunner(hydrationResult.data, runContext);
        agentRunner.setInputEvent(this.inputEvent);

        // Run the agent runner with streaming parameters
        let result: ApprovalResult<SessionWithTracking<Session>, OpenAIAgent<SessionWithTracking<Session>, AgentOutputType>>;
        try {
            result = await agentRunner.run({
                runId,
                userId: this.user.id,
                agentId: agent.id,
            });
        } catch (error) {
            // Log the error and update run history
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Error running agent "${agent.name}"`, { error, agentId: agent.id, agentName: agent.name, runId });

            try {
                await markRunFailed(runId, errorMessage, 'agent');
                emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', agent.id);
            } catch (e) {
                logger.error('Failed to mark run as failed', { error, runId, agentId: agent.id });
            }

            // Re-throw to be caught by outer try-catch
            throw error;
        }

        if (result.status === 'completed') {
            logger.info(`Agent "${agent.name}" completed:`, { finalOutput: result.result.finalOutput });
            return persistRunResult(runId, result.result, session, agent, result);
        } else {
            logger.info(`Agent "${agent.name}" awaiting approval:`);
            return new ProcessorResult<SessionWithTracking<Session>>(false, "Agent awaiting approval", agent, result);
        }
    }
}

async function persistRunResult<T extends Session>(
    runId: string,
    result: RunResult<SessionWithTracking<T>, OpenAIAgent<SessionWithTracking<T>, AgentOutputType>>,
    session: T,
    agent: PrismaAgent,
    approvalResult?: ApprovalResult<SessionWithTracking<T>, OpenAIAgent<SessionWithTracking<T>, AgentOutputType>> | null
): Promise<ProcessorResult<SessionWithTracking<T>>> {
    // Finalize run status
    const hasFinalOutput = Boolean(result.finalOutput);
    try {
        await finalizeRunStatus(runId, hasFinalOutput ? 'success' : 'failed');
        // Invalidate all run history queries for this agent when status changes
        emitCacheInvalidationWithWildcard(session.user.id, 'runHistory', agent.id);
    } catch (e) {
        logger.error('Failed to finalize run status', { error: e, runId, agentId: agent.id });
    }

    const finalOutput = typeof result.finalOutput === 'string' ? result.finalOutput : '';
    return new ProcessorResult<SessionWithTracking<T>>(
        hasFinalOutput,
        finalOutput,
        agent,
        approvalResult
    );
}

export async function persistRunAction<T extends Session>(
    runId: string,
    agent: PrismaAgent,
    session: T,
    action: RunHistoryAction,
): Promise<string | undefined> {
    try {
        const actionId = await appendRunAction(runId, action);
        emitCacheInvalidationWithWildcard(session.user.id, 'runHistory', agent.id);
        emitCacheInvalidationWithKey(session.user.id, 'recentActions');
        return actionId;
    } catch (e) {
        logger.error('Failed to append run action', { error: e, runId, agentId: agent.id });
    }
    return undefined;
}

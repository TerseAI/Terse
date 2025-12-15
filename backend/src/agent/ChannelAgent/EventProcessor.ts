import chalk from 'chalk';
import { db } from '../../prismaClient';
import { Channel, ChannelWithRelations, User } from '../../types/prisma';
import { InputEvent } from '../../integrations/abstract/InputEvent';
import { OutputFactory } from '../../outputs/abstract/OutputFactory';
import { ChannelAgent } from './ChannelAgent';
import { filterEvent } from './EventFilter';
import { createRunRecord, finalizeRunStatus, markRunFailed, markRunProcessed, markRunSkipped, appendRunAction } from './runHistory';
import { ApprovalResult } from './ChannelAgent';
import { Agent, AgentOutputType, RunResult } from '@openai/agents';
import { Session } from '../../server';
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from '../../realtimeSocket';
import { getInputConfigInclude, getOutputConfigInclude } from '../../utility/prismaIncludes';
import { RunHistoryAction } from '../../shared/RunHistoryTypes';
import { RunContext } from './SystemPromptBuilder';
import logger from '../../logger';

// The job of this class is to take an Input Event, and check if it's a match for an Channel.
// It will then create a Session, and summon the Channel Agent with the create user data.

export class ProcessorResult<T extends Session = Session> {
    success: boolean;
    message: string;
    channel: Channel | null;
    approvalResult?: ApprovalResult<T, Agent<T, AgentOutputType>> | null;

    constructor(success: boolean, message: string, channel: Channel | null, approvalResult?: ApprovalResult<T, Agent<T, AgentOutputType>> | null) {
        this.success = success;
        this.message = message;
        this.channel = channel;
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

        // Find all active channels for this user (already includes all config relations)
        const channels: ChannelWithRelations[] = await db().automations.findMany({
            where: {
                user_id: this.user.id,
                is_active: true,
            },
            include: {
                prompt: true,
                inputs: {
                    include: getInputConfigInclude()
                },
                output: {
                    include: getOutputConfigInclude()
                }
            }
        }) as ChannelWithRelations[];

        if (channels.length === 0) {
            return [new ProcessorResult(false, "No channels found for this user", null)];
        }

        // Filter channels using event's own filtering method
        // Each event type handles its own matching logic (no switch statements)
        const matchingChannels = channels.filter(channel =>
            channel.inputs.some(input => this.inputEvent.matchesChannelInput(input))
        );

        if (matchingChannels.length === 0) {
            return [new ProcessorResult(false, `No channels match this ${integrationType} event`, null)];
        }

        logger.info(`Found ${matchingChannels.length} matching channel(s) for ${integrationType} event`);

        // Process each matching channel
        for (const channel of matchingChannels) {
            try {
                const result = await this.processChannel(channel);
                results.push(result);
            } catch (error) {
                logger.error(`Error processing channel ${channel.id}`, { error, channelId: channel.id, channelName: channel.name });
                results.push(new ProcessorResult(
                    false,
                    `Error processing channel: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    channel
                ));
            }
        }

        return results;
    }

    private async processChannel(channel: ChannelWithRelations): Promise<ProcessorResult> {
        logger.info(`Processing channel: ${channel.name} (${channel.id})`);

        if (!channel.prompt) {
            return new ProcessorResult(false, "No prompt found for this channel", channel);
        }

        // Initialize run history record with trigger details
        const trigger = this.inputEvent.createTriggerMetadata();
        const runId = await createRunRecord({
            channelId: channel.id,
            trigger,
        });
        emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', channel.id);
        emitCacheInvalidationWithKey(this.user.id, 'recentChannels');

        // Get the output from channel relations (already fetched with config)
        const outputIntegration = channel.output;

        if (!outputIntegration) {
            return new ProcessorResult(false, "No output integration found for this channel", channel);
        }

        // Use OutputFactory to create output based on config type (no hardcoded Notion logic)
        const output = OutputFactory.createOutput(outputIntegration.config_type);
        if (!output) {
            return new ProcessorResult(false, `Output type ${outputIntegration.config_type} is not supported`, channel);
        }

        // Use output's config-aware session creation (no hardcoded config extraction)
        // Each output type knows how to fetch its own integration and extract its config
        let session: Session;
        try {
            session = await output.createSessionFromConfig(
                outputIntegration.integration_id,
                outputIntegration,
                this.user
            );
        } catch (error) {
            return new ProcessorResult(
                false,
                `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
                channel
            );
        }

        // Filter the event using AI to see if it's relevant to this channel
        let filterResult;
        try {
            const filterResponse = await filterEvent(
                this.inputEvent,
                channel.prompt,
                {
                    runId,
                    userId: this.user.id,
                    channelId: channel.id,
                }
            );
            
            filterResult = filterResponse.result;
        } catch (error) {
            // Log the error and update run history
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Error filtering event for channel "${channel.name}"`, { error, channelId: channel.id, channelName: channel.name, runId });
            
            try {
                await markRunFailed(runId, errorMessage, 'filter');
                emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', channel.id);
            } catch (e) {
                logger.error('Failed to mark run as failed', { e, runId, channelId: channel.id });
            }
            
            return new ProcessorResult(
                false,
                `Error during filtering: ${errorMessage}`,
                channel
            );
        }

        if (!filterResult.isRelevant) {
            logger.info(`Event is not relevant to channel "${channel.name}": ${filterResult.reason}`);
            try {
                await markRunSkipped(runId, filterResult.reason);
                // Emit cache invalidation to update UI
                emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', channel.id);
            } catch (e) {
                logger.error('Failed to mark run skipped', { error: e, runId, channelId: channel.id });
            }
            return new ProcessorResult(false, `Not relevant: ${filterResult.reason}`, channel);
        }

        try {
            await markRunProcessed(runId, filterResult.reason);
        } catch (e) {
            logger.error('Failed to mark run processed', { error: e, runId, channelId: channel.id });
        }

        logger.info(`Event is relevant to channel "${channel.name}"`);

        // Create channel agent with the session and output
        const runContext: RunContext = { runId };
        const channelAgent = new ChannelAgent(session, output, channel, runContext);
        channelAgent.setInputEvent(this.inputEvent);
        
        // Run the channel agent with streaming parameters
        let result: ApprovalResult<Session, Agent<Session, AgentOutputType>>;
        try {
            result = await channelAgent.run({
                runId,
                userId: this.user.id,
                channelId: channel.id,
            }) as unknown as ApprovalResult<Session, Agent<Session, AgentOutputType>>;
        } catch (error) {
            // Log the error and update run history
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Error running channel agent for "${channel.name}"`, { error, channelId: channel.id, channelName: channel.name, runId });
            
            try {
                await markRunFailed(runId, errorMessage, 'agent');
                emitCacheInvalidationWithWildcard(this.user.id, 'runHistory', channel.id);
            } catch (e) {
                logger.error('Failed to mark run as failed', { error, runId, channelId: channel.id });
            }
            
            // Re-throw to be caught by outer try-catch
            throw error;
        }

        if (result.status === 'completed') {
            logger.info(`Channel "${channel.name}" completed:`, {finalOutput: result.result.finalOutput});
            return persistRunResult(runId, result.result, session, channel, result);
        } else {
            logger.info(`Channel "${channel.name}" awaiting approval:`);
            return new ProcessorResult(false, "Channel awaiting approval", channel, result);
        }
    }
}

async function persistRunResult<T extends Session>(
    runId: string,
    result: RunResult<T, Agent<T, AgentOutputType>>,
    session: T,
    channel: Channel,
    approvalResult?: ApprovalResult<T, Agent<T, AgentOutputType>> | null
): Promise<ProcessorResult<T>> {
    // Finalize run status
    const hasFinalOutput = Boolean(result.finalOutput);
    try {
        await finalizeRunStatus(runId, hasFinalOutput ? 'success' : 'failed');
        // Invalidate all run history queries for this channel when status changes
        emitCacheInvalidationWithWildcard(session.user.id, 'runHistory', channel.id);
    } catch (e) {
        logger.error('Failed to finalize run status', { error: e, runId, channelId: channel.id });
    }

    const finalOutput = typeof result.finalOutput === 'string' ? result.finalOutput : '';
    return new ProcessorResult<T>(
        hasFinalOutput,
        finalOutput,
        channel,
        approvalResult
    );
}

export async function persistRunAction<T extends Session>(
    runId: string,
    channel: Channel,
    session: T,
    action: RunHistoryAction,
): Promise<string | undefined> {
    try {
        const actionId = await appendRunAction(runId, action);
        emitCacheInvalidationWithWildcard(session.user.id, 'runHistory', channel.id);
        emitCacheInvalidationWithKey(session.user.id, 'recentActions');
        return actionId;
    } catch (e) {
        logger.error('Failed to append run action', { error: e, runId, channelId: channel.id });
    }
    return undefined;
}
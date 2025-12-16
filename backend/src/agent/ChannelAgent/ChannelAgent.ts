import { Agent, AgentInputItem, AgentOutputType, Tool, RunResult, RunState, RunToolApprovalItem, Runner, run, user } from '@openai/agents';
import { Session } from '../../server';
import { SystemPromptBuilder, RunContext, SystemPromptBuilderDependencies } from './SystemPromptBuilder';
import { InputEvent } from '../../integrations/abstract/InputEvent';
import { Output } from '../../outputs/abstract/Output';
import { ChannelInput, ChannelOutput, ChannelWithRelations } from '../../types/prisma';
import { ConfigInstance } from '../../shared/Configs';
import { settings } from '../../config/settings';
import { formatChannelInputsForAgent, formatChannelOutputForAgent } from './formatContext';
import { UserFormatter } from '../../utility/UserFormatter';
import { transformAgentStreamToModelEvents } from '../streaming';
import { getRealtimeSocket } from '../../realtimeSocket';
import type { RunHistoryAction, RunHistoryStreamingParams, RunHistoryModelEvent, RunHistoryModelSocketEvent } from '../../shared/RunHistoryTypes';
import { EntityType } from '../../shared/Entities';
import { ChangedItem, ChangeEventType, ModelEvent } from '../../shared/ModelEvents';
import { persistRunAction } from './EventProcessor';
import { processModelEventStream } from './StreamProcessor';
import { recentHistoryCallback, RunHistoryChatMemorySession } from '../CustomMemorySession';
import { IntegrationType } from '../../shared/Integrations';
import { InputImageContent, InputTextContent } from 'openai/resources/conversations/conversations.mjs';
import { runnerFactory } from '../runner';
import { NotificationManager } from '../../notifications/Notification';
import { storePendingApprovalState, getPendingApprovalState, clearPendingApprovalState, storeChatEvent, markRunInProgress } from './runHistory';
import logger from '../../logger';


export class ChannelAgent<T extends Session, TConfig extends ConfigInstance> {
    private session: T;
    private inputEvent: InputEvent | null = null;
    private channel: ChannelWithRelations;
    private output: Output<T, TConfig>;
    private agent?: Agent<SessionWithTracking<T>, AgentOutputType>;
    private tools: Tool<SessionWithTracking<T>>[] = [];
    private runContext: RunContext;
    private toolMetadataMap: Map<string, ToolMetadata> = new Map();
    private pendingActions: RunHistoryAction[] = [];
    private memorySession: RunHistoryChatMemorySession;
    private maxTurns: number;
    private notificationManager: NotificationManager;

    constructor(
        session: T,
        output: Output<T, TConfig>,
        channel: ChannelWithRelations,
        runContext: RunContext,
        maxTurns: number = 50
    ) {
        this.session = session;
        this.output = output;
        this.channel = channel;
        this.tools = output.toolbox.map(entry => entry.tool);
        this.runContext = runContext;
        this.buildToolMetadataMap();
        this.memorySession = new RunHistoryChatMemorySession({
            sessionId: runContext.runId,
        });
        if (!maxTurns || maxTurns < 1) {
            throw new Error("Max turns must be greater than 0");
        }
        this.maxTurns = maxTurns;
        this.notificationManager = new NotificationManager(session.user, channel);
    }

    async run(streamingParams?: RunHistoryStreamingParams): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        if (!this.inputEvent) {
            throw new Error("No input event set. Call setInputEvent() before run()");
        }

        await this.initializeAgent();

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before run()");
        }

        const userMessage = this.buildUserMessage();
        const userHistory = this.buildUserHistory(userMessage);

        const runner = runnerFactory({
            channelId: this.channel.id,
            runId: this.runContext.runId,
            userId: this.session.user.id,
            env: settings.nodeEnv,
        })
        const result = await runner.run(
            this.agent,
            userHistory,
            {
                context: this.getToolContext(),
                stream: true,
                session: this.memorySession,
                sessionInputCallback: recentHistoryCallback,
                maxTurns: this.maxTurns
            });

        await this.processStream(result, streamingParams);

        return await this.buildResult(result, streamingParams);
    }

    async userMessageRun(userMessage: string, streamingParams?: RunHistoryStreamingParams): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        await this.initializeAgent();

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before run()");
        }

        const userHistory = this.buildUserHistory(userMessage);

        const runner = runnerFactory({
            channelId: this.channel.id,
            runId: this.runContext.runId,
            userId: this.session.user.id,
            env: settings.nodeEnv,
        })
        const result = await runner.run(this.agent, userHistory, {
            context: this.getToolContext(),
            stream: true,
            session: this.memorySession,
            sessionInputCallback: recentHistoryCallback,
            maxTurns: this.maxTurns
        });

        await this.processStream(result, streamingParams);

        return await this.buildResult(result, streamingParams);
    }

    private buildUserHistory(userMessage: string | (InputTextContent | InputImageContent)[]): AgentInputItem[] {
        // Directives are now included in the system prompt via SystemPromptBuilder.buildDirectivesSection()
        // to avoid accumulating duplicate directive entries in session history on each conversation turn.
        return [{ role: 'user' as const, content: userMessage }];
    }

    async resumeFromPendingApproval(
        decision: Decision,
        stepId: string,
        streamingParams?: RunHistoryStreamingParams
    ): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        await this.initializeAgent();

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before resumeFromPendingApproval()");
        }

        // Retrieve pending approval state from database
        const pendingState = await getPendingApprovalState(this.runContext.runId);
        if (!pendingState) {
            throw new Error(`No pending approval state found for run ${this.runContext.runId}`);
        }

        // Deserialize state
        if (!pendingState.serializedState || typeof pendingState.serializedState !== 'string') {
            throw new Error(`Invalid serialized state format for run ${this.runContext.runId}. Expected string, got ${typeof pendingState.serializedState}`);
        }

        // Deserialize the state first
        const state = await RunState.fromString(this.agent, pendingState.serializedState);

        // Find the interruption from the stored interruptions array
        // We stored the full interruption objects, so we can use them directly
        // Helper to safely extract callId from interruption rawItem
        const getInterruptionCallId = (int: RunToolApprovalItem): string | undefined => {
            if (int.rawItem && typeof int.rawItem === 'object' && 'callId' in int.rawItem) {
                return int.rawItem.callId as string | undefined;
            }
            return undefined;
        };

        const storedInterruption = pendingState.interruptions.find((int) => {
            const callId = getInterruptionCallId(int);
            return callId === stepId;
        });

        if (!storedInterruption) {
            // Log for debugging
            logger.error(`[resumeFromPendingApproval] Could not find interruption for step_id: ${stepId}`);
            const getInterruptionCallId = (int: RunToolApprovalItem): string | undefined => {
                if (int.rawItem && typeof int.rawItem === 'object' && 'callId' in int.rawItem) {
                    return int.rawItem.callId as string | undefined;
                }
                return undefined;
            };
            logger.error(`[resumeFromPendingApproval] Available stored interruptions:`, { interruptions: pendingState.interruptions.map((int) => ({
                callId: getInterruptionCallId(int),
                name: int.name
            })) });
            throw new Error(`Could not find matching interruption for step_id ${stepId}`);
        }

        // Use the stored interruption object directly (matching SDK pattern)
        // The interruption object should be compatible with state.approve/reject
        const interruption = storedInterruption as RunToolApprovalItem;

        // Apply decision using the stored interruption
        if (decision === 'approve') {
            state.approve(interruption);
        } else {
            state.reject(interruption);
            const rejectionMessage = user(`The tool call "${interruption.name}" was rejected. What should I do differently? Please ask me what changes you'd like me to make, or if you'd like me to skip this action entirely.`);
            const stateWithHistory = state as unknown as { history?: AgentInputItem[] };
            if (stateWithHistory.history && Array.isArray(stateWithHistory.history)) {
                stateWithHistory.history.push(rejectionMessage);
                logger.info("[resumeFromPendingApproval] Added rejection message to state history");
            } else {
                logger.warn("[resumeFromPendingApproval] Could not access state.history directly.");
            }
        }

        // Move run back to in-progress now that we're resuming execution
        await markRunInProgress(this.runContext.runId);

        // Clear pending approval state
        await clearPendingApprovalState(this.runContext.runId);

        // Resume execution
        const runner = runnerFactory({
            channelId: this.channel.id,
            runId: this.runContext.runId,
            userId: this.session.user.id,
            env: settings.nodeEnv,
        });
        const toolContext = this.getToolContext();

        // Bug in the SDK where functions are not serialized properly.
        // This is a workaround to get the context to work.
        const unifiedContext = {
            ...toolContext,
            ...state._context,
        }
        state._context.context = unifiedContext;

        const result = await runner.run(this.agent, state, {
            context: toolContext,
            stream: true,
            session: this.memorySession,
            sessionInputCallback: recentHistoryCallback,
            maxTurns: this.maxTurns
        });

        await this.processStream(result, streamingParams);

        return await this.buildResult(result, streamingParams);
    }

    setInputEvent(event: InputEvent): void {
        this.inputEvent = event;
    }

    queueAction(action: RunHistoryAction): void {
        this.pendingActions.push(action);
    }

    async flushPendingActions(stepId: string, toolName: string): Promise<ChangedItem[]> {
        const changedItems: ChangedItem[] = [];
        const toolMetadata = this.toolMetadataMap.get(toolName);
        const isReadOnly = toolMetadata?.isReadOnly ?? true;

        for (const action of this.pendingActions) {
            const actionId = await persistRunAction(this.runContext.runId, this.channel, this.session, {
                ...action,
                step_id: stepId,
                isReadOnly,
            });
            if (actionId) {
                changedItems.push({
                    type_name: EntityType.RUN_HISTORY_ACTION,
                    id: actionId,
                    change_event_type: ChangeEventType.ACTION_EXECUTED
                });
            }
            await this.notificationManager.notify(action);
        }

        this.pendingActions = [];
        return changedItems;
    }

    private buildToolMetadataMap(): void {
        this.output.toolbox.forEach(entry => {
            this.toolMetadataMap.set(entry.tool.name, {
                integration: entry.integration,
                isReadOnly: entry.isReadOnly,
            });
        });
    }

    private chooseModel(): string {
        return settings.nodeEnv === 'development' ? 'gpt-5-nano' : 'gpt-5';
    }

    async initializeAgent(): Promise<void> {
        const deps: SystemPromptBuilderDependencies<T, TConfig> = {
            session: this.session,
            channel: this.channel,
            output: this.output,
        };

        const builder = new SystemPromptBuilder(deps, this.runContext)
            .withStandardSections();

        const fullSystemPrompt = await builder.build();

        this.agent = new Agent<SessionWithTracking<T>, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: fullSystemPrompt,
            model: this.chooseModel(),
            tools: this.tools,
        });
    }

    private getToolContext(): SessionWithTracking<T> {
        return {
            ...this.session,
            trackAction: (action: RunHistoryAction) => this.queueAction(action),
            channel: {
                requireApproval: this.channel.require_approval ?? false,
            },
        };
    }

    private buildUserMessage(): (InputTextContent | InputImageContent)[] {
        const textContent = this.buildTextContent();
        const content: (InputTextContent | InputImageContent)[] = [{ type: 'input_text', text: textContent }];

        const imageUrls = this.inputEvent!.getImageUrls();
        for (const imageUrl of imageUrls) {
            content.push({ type: 'input_image', image_url: imageUrl, detail: 'auto' });
        }

        return content;
    }

    private buildTextContent(): string {
        return `
<USER_CONTEXT>
${UserFormatter.formatForAgent(this.session.user)}
</USER_CONTEXT>

<USER_INSTRUCTIONS>
${this.channel.prompt?.content || 'No instructions provided'}
</USER_INSTRUCTIONS>

<CHANNEL_INPUTS>
${formatChannelInputsForAgent(this.channel.inputs as ChannelInput[])}
</CHANNEL_INPUTS>

<OUTPUT_DESTINATION>
${formatChannelOutputForAgent(this.channel.output as ChannelOutput)}
</OUTPUT_DESTINATION>

<EVENT>
${this.inputEvent!.formatForChannelAgent()}
</EVENT>
        `.trim();
    }

    private async processStream(
        result: any,
        streamingParams?: RunHistoryStreamingParams
    ): Promise<void> {
        const shouldStream = this.shouldEnableStreaming(streamingParams);

        if (shouldStream) {
            await this.processWithStreaming(result, streamingParams!);
        } else {
            await this.processWithLogging(result);
        }
    }

    private shouldEnableStreaming(params?: RunHistoryStreamingParams): boolean {
        return !!(params?.runId && params?.userId && params?.channelId);
    }

    private async processWithStreaming(
        result: any,
        streamingParams: RunHistoryStreamingParams
    ): Promise<void> {
        const io = getRealtimeSocket();

        const eventStream = transformAgentStreamToModelEvents(result, {
            toolToIntegrationMap: this.getToolToIntegrationMap(),
            onToolCallComplete: (callId, toolName) => this.flushPendingActions(callId, toolName),
        });

        await processModelEventStream(eventStream, {
            runId: streamingParams.runId!,
            userId: streamingParams.userId!,
            channelId: streamingParams.channelId!,
            io,
        });
    }

    private getToolToIntegrationMap(): Map<string, IntegrationType> {
        const map = new Map<string, IntegrationType>();
        this.toolMetadataMap.forEach((metadata, toolName) => {
            map.set(toolName, metadata.integration);
        });
        return map;
    }

    private async processWithLogging(result: any): Promise<void> {
        for await (const event of result) {
            this.logRawEvent(event);
        }
    }

    private logRawEvent(event: any): void {
        if (event.type === 'raw_model_stream_event') {
            logger.info(event.type, { data: event.data });
        } else if (event.type === 'agent_updated_stream_event') {
            logger.info(event.type, { agentName: event.agent.name });
        } else if (event.type === 'run_item_stream_event') {
            logger.info(event.type, { item: event.item });
        }
    }

    private async buildResult(
        result: any,
        streamingParams?: RunHistoryStreamingParams
    ): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        const hasInterruptions = result.interruptions && result.interruptions.length > 0;

        if (hasInterruptions) {
            const serializedState = JSON.stringify(result.state);
            const interruptionsToStore = result.interruptions.map((interruption: RunToolApprovalItem) => {
                // Store the full interruption object, including rawItem which contains callId
                return {
                    type: interruption.type || 'tool_approval_item',
                    rawItem: interruption.rawItem,
                    agent: interruption.agent,
                    toolName: interruption.toolName || interruption.name,
                    name: interruption.name,
                    arguments: interruption.arguments,
                };
            });

            // Store pending approval state in database
            await storePendingApprovalState(
                this.runContext.runId,
                serializedState,
                interruptionsToStore
            );

            // Emit ToolApprovalRequest events for each interruption
            if (streamingParams && this.shouldEnableStreaming(streamingParams)) {
                const io = getRealtimeSocket();
                for (const interruption of result.interruptions) {
                    // Safely extract callId from interruption rawItem
                    const getCallId = (int: RunToolApprovalItem): string => {
                        if (int.rawItem && typeof int.rawItem === 'object' && 'callId' in int.rawItem) {
                            const callId = int.rawItem.callId;
                            if (typeof callId === 'string') {
                                return callId;
                            }
                        }
                        return int.name || 'unknown';
                    };
                    const stepId = getCallId(interruption);
                    const approvalRequest: ModelEvent = {
                        type: 'ToolApprovalRequest',
                        step_id: stepId || interruption.name,
                        name: interruption.name,
                        arguments: interruption.arguments,
                    };

                    // Store and emit the approval request
                    const eventId = await storeChatEvent(this.runContext.runId, approvalRequest);

                    if (io) {
                        const runHistoryModelEvent: RunHistoryModelEvent = {
                            ...approvalRequest,
                            id: eventId,
                            timestamp: new Date().toISOString(),
                        };
                        const payload: RunHistoryModelSocketEvent = {
                            runId: streamingParams.runId!,
                            channelId: streamingParams.channelId!,
                            runHistoryModelEvent,
                        };
                        io.to(`user:${streamingParams.userId}`).emit('channel:chat:event', payload);
                    }

                    // Send notification for approval request
                    try {
                        const toolMetadata = this.toolMetadataMap.get(interruption.name);
                        const integration = toolMetadata?.integration || IntegrationType.TERSE;

                        const approvalAction: RunHistoryAction = {
                            action: `Approval requested for ${interruption.name}`,
                            integration,
                            target: interruption.name,
                            details: `The bot is requesting approval to execute: ${interruption.name} with arguments: ${JSON.stringify(interruption.arguments)}`,
                            step_id: stepId,
                            type: 'approval',
                            isReadOnly: false,
                        };

                        await this.notificationManager.notify(approvalAction, this.runContext.runId);
                    } catch (error) {
                        logger.error('Failed to send approval request notification:', { error });
                    }
                }
            }

            return {
                status: 'awaiting_approval',
                state: result.state,
                interruptions: result.interruptions,
            };
        }

        // Clear any pending approval state if run completed successfully
        await clearPendingApprovalState(this.runContext.runId);

        return {
            status: 'completed',
            result,
        };
    }
}

export type SessionWithTracking<T extends Session> = T & {
    trackAction(action: RunHistoryAction): void;
    channel: {
        requireApproval: boolean;
    };
}

export type ApprovalResult<T extends Session, AgentType extends Agent<T, AgentOutputType>> =
    | { status: 'completed'; result: RunResult<T, AgentType> }
    | { status: 'awaiting_approval'; state: RunState<T, AgentType>; interruptions: RunToolApprovalItem[] };

export type Decision = 'approve' | 'reject';

type ToolMetadata = {
    integration: IntegrationType;
    isReadOnly: boolean;
};

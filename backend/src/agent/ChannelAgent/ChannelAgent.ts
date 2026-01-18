import { Agent, AgentInputItem, AgentOutputType, Tool, RunResult, RunState, RunToolApprovalItem, Runner, run, user, StreamedRunResult, RunStreamEvent, protocol } from '@openai/agents';
import { Session } from '../../server';
import { SystemPromptBuilder, RunContext, SystemPromptBuilderDependencies } from './SystemPromptBuilder';
import { InputEvent } from '../../integrations/abstract/InputEvent';
import { Output } from '../../outputs/abstract/Output';
import { ChannelInput, ChannelOutput, ChannelWithRelations, ChannelOutputWithConfigs } from '../../types/prisma';
import { ConfigInstance } from '../../shared/Configs';
import { settings } from '../../config/settings';
import { formatChannelInputsForAgent, formatChannelOutputForAgent, formatChannelOutputsForAgent } from './formatContext';
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
import { runnerFactory } from '../runner';
import { NotificationManager } from '../../notifications/Notification';
import { storePendingApprovalState, getPendingApprovalState, clearPendingApprovalState, storeChatEvent, markRunInProgress } from './runHistory';
import { persistOutputAttributions, removeOutputAttributions } from './persistOutputAttributions';
import logger from '../../logger';
import { RunHistoryActionType } from '@prisma/client';
import { KnowledgeBase } from '../../knowledgeBase/abstract/KnowledgeBase';
import { ChannelKnowledgeBaseWithConfigs } from '../../types/prisma';

// Types from @openai/agents SDK for content items
type AgentInputText = protocol.InputText;
type AgentInputImage = protocol.InputImage;

export class ChannelAgent<
    T extends Session,
    K extends Session,
    TConfig extends ConfigInstance,
    KBConfig extends ConfigInstance
> {
    private session: T;
    private inputEvent: InputEvent | null = null;
    private channel: ChannelWithRelations;
    private outputs: Output<Session, ConfigInstance>[];
    private outputSessions: Session[];
    private outputChannelConfigs: ChannelOutputWithConfigs[];
    private knowledgeBases: KnowledgeBase<K, KBConfig>[];
    private knowledgeBaseChannelConfigs: ChannelKnowledgeBaseWithConfigs[];
    private knowledgeBaseSessions: K[] = [];
    private agent?: Agent<SessionWithTracking<T & K>, AgentOutputType>;
    private tools: Tool<SessionWithTracking<T & K>>[] = [];
    private runContext: RunContext;
    private toolMetadataMap: Map<string, ToolMetadata> = new Map();
    private pendingActions: RunHistoryAction[] = [];
    private memorySession: RunHistoryChatMemorySession;
    private maxTurns: number;
    private notificationManager: NotificationManager;

    constructor(
        session: T,
        outputs: Output<Session, ConfigInstance>[],
        outputSessions: Session[],
        outputChannelConfigs: ChannelOutputWithConfigs[],
        knowledgeBases: KnowledgeBase<K, KBConfig>[],
        knowledgeBaseChannelConfigs: ChannelKnowledgeBaseWithConfigs[],
        channel: ChannelWithRelations,
        runContext: RunContext,
        maxTurns: number = 50
    ) {
        if (knowledgeBases.length !== knowledgeBaseChannelConfigs.length) {
            throw new Error(`Mismatch between knowledge base instances (${knowledgeBases.length}) and channel configs (${knowledgeBaseChannelConfigs.length})`);
        }
        if (outputs.length !== outputSessions.length || outputs.length !== outputChannelConfigs.length) {
            throw new Error(`Mismatch between output instances (${outputs.length}), sessions (${outputSessions.length}), and configs (${outputChannelConfigs.length})`);
        }
        if (outputs.length === 0) {
            throw new Error(`At least one output is required`);
        }

        this.session = session;
        this.outputs = outputs;
        this.outputSessions = outputSessions;
        this.outputChannelConfigs = outputChannelConfigs;
        this.knowledgeBases = knowledgeBases;
        this.knowledgeBaseChannelConfigs = knowledgeBaseChannelConfigs;
        this.channel = channel;
        this.tools = [
            ...outputs.flatMap(output => output.toolbox.map(entry => entry.tool)),
            ...knowledgeBases.flatMap(kb => kb.toolbox.map(entry => entry.tool))
        ];

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

        const userMessage = this.buildUserMessage(this.inputEvent);
        const userHistory: AgentInputItem[] = this.buildUserHistory(userMessage);

        const runner = runnerFactory({
            channelId: this.channel.id,
            runId: this.runContext.runId,
            userId: this.session.user.id,
            env: settings.nodeEnv,
        })

        logger.info("User history build to be sent to agent", { userHistory: JSON.stringify(userHistory, null, 2) });

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

    private buildUserHistory(userMessage: string | (AgentInputText | AgentInputImage)[]): AgentInputItem[] {
        // Directives are now included in the system prompt via SystemPromptBuilder.buildDirectivesSection()
        // to avoid accumulating duplicate directive entries in session history on each conversation turn.
        return [{ role: 'user' as const, content: userMessage }];
    }

    async resumeFromPendingApproval(
        decision: Decision,
        stepId: string,
        streamingParams?: RunHistoryStreamingParams,
        rejectionReason?: string,
        hardReject?: boolean
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
        const state = await RunState.fromString<SessionWithTracking<T & K>, Agent<SessionWithTracking<T & K>, AgentOutputType>>(this.agent, pendingState.serializedState);

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
            logger.error(`[resumeFromPendingApproval] Available stored interruptions:`, {
                interruptions: pendingState.interruptions.map((int) => ({
                    callId: getInterruptionCallId(int),
                    name: int.name
                }))
            });
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
            const stateWithHistory = state as unknown as { history?: AgentInputItem[] };
            if (stateWithHistory.history && Array.isArray(stateWithHistory.history)) {
                if (hardReject) {
                    // Hard reject: tell the agent to stop completely without asking questions or retrying
                    const hardRejectMessage = user(
                        `A human reviewer rejected your previous tool call "${interruption.name}" and has chosen to stop this workflow entirely.\n\n` +
                        `Do NOT ask any follow-up questions. Do NOT attempt to retry or suggest alternatives. ` +
                        `Simply acknowledge that the action was rejected and the workflow has been stopped. ` +
                        `End your response with a brief confirmation that no further actions will be taken.`
                    );
                    stateWithHistory.history.push(hardRejectMessage);
                    logger.info("[resumeFromPendingApproval] Added hard reject message to state history", { hardReject: true });
                } else {
                    const trimmedReason = rejectionReason?.trim();
                    if (trimmedReason) {
                        // Treat the rejection reason as actionable user guidance (verbatim) so the agent can
                        // reliably detect "try again" or other imperative instructions (e.g. "Read X first").
                        const rejectionGuidance = user(
                            `A human reviewer rejected your previous tool call "${interruption.name}".\n\n` +
                            `Reviewer feedback (treat as user instructions, verbatim):\n` +
                            `${trimmedReason}\n\n` +
                            `If the feedback asks you to retry (e.g. "try again", "retry") OR provides guidance on how to proceed differently (e.g. "read X first", "narrow the scope"), proceed now by adapting your next steps/tool calls accordingly. ` +
                            `Only ask a clarification question if the feedback is not sufficient to act.`
                        );
                        stateWithHistory.history.push(rejectionGuidance);
                        logger.info("[resumeFromPendingApproval] Added rejection guidance to state history", { hasCustomReason: true });
                    } else {
                        const rejectionMessage = user(
                            `The tool call "${interruption.name}" was rejected. ` +
                            `Ask the user what they want you to do differently, or whether to skip this action entirely.`
                        );
                        stateWithHistory.history.push(rejectionMessage);
                        logger.info("[resumeFromPendingApproval] Added rejection message to state history", { hasCustomReason: false });
                    }
                }
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
        const unifiedContext: SessionWithTracking<T & K> = {
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

            // Persist output attributions if:
            // 1. Input event is Identifiable
            // 2. Action has output_items populated
            // 3. Action is not read-only (track both write and read actions per user request)
            const sourceItemRef = this.inputEvent?.getIdentifiableInfo();
            if (sourceItemRef && action.output_items && action.output_items.length > 0 && !isReadOnly) {
                if (action.type === RunHistoryActionType.delete) {
                    await removeOutputAttributions(
                        this.channel.id,
                        action
                    );
                } else { // if we create or update, we persist
                    await persistOutputAttributions(
                        this.channel.id,
                        sourceItemRef,
                        action
                    );
                }
            }
        }

        this.pendingActions = [];
        return changedItems;
    }

    private buildToolMetadataMap(): void {
        // Populate metadata from all output toolboxes
        this.outputs.forEach(output => {
            output.toolbox.forEach(entry => {
                this.toolMetadataMap.set(entry.tool.name, {
                    integration: entry.integration,
                    isReadOnly: entry.isReadOnly,
                });
            });
        });

        // Populate metadata from knowledge base toolboxes
        this.knowledgeBases.forEach(kb => {
            kb.toolbox.forEach(entry => {
                this.toolMetadataMap.set(entry.tool.name, {
                    integration: entry.integration,
                    isReadOnly: entry.isReadOnly,
                });
            });
        });
    }

    private chooseModel(): string {
        return settings.nodeEnv === 'development' ? 'gpt-5-nano' : 'gpt-5.2';
    }

    async initializeAgent(): Promise<void> {
        // Pair each knowledge base instance with its corresponding channel config by index
        this.knowledgeBaseSessions = await Promise.all(
            this.knowledgeBases.map((kb, index) => {
                const channelKnowledgeBase = this.knowledgeBaseChannelConfigs[index];
                if (!channelKnowledgeBase) {
                    throw new Error(`Channel knowledge base config not found at index ${index} for ${kb.integration}`);
                }
                // Verify the types match as a sanity check
                if (channelKnowledgeBase.config_type !== kb.integration) {
                    throw new Error(`Type mismatch: knowledge base at index ${index} is ${kb.integration} but channel config is ${channelKnowledgeBase.config_type}`);
                }
                return kb.createSessionFromConfig(
                    channelKnowledgeBase.integration_id,
                    channelKnowledgeBase,
                    this.session.user
                );
            })
        );

        const deps: SystemPromptBuilderDependencies<T, TConfig, K, KBConfig> = {
            session: this.session,
            channel: this.channel,
            outputs: this.outputs,
            outputSessions: this.outputSessions,
            knowledgeBases: this.knowledgeBases,
            knowledgeBaseSessions: this.knowledgeBaseSessions,
        };

        const builder = new SystemPromptBuilder(deps, this.runContext)
            .withStandardSections();

        const fullSystemPrompt = await builder.build();

        this.agent = new Agent<SessionWithTracking<T & K>, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: fullSystemPrompt,
            model: this.chooseModel(),
            tools: this.tools,
        });
    }

    private getToolContext(): SessionWithTracking<T & K> {
        const baseContext = {
            ...this.session,
            ...this.outputSessions.reduce(
                (acc, outputSession) => ({ ...acc, ...outputSession }),
                {} as Session
            ),
            ...this.knowledgeBaseSessions.reduce(
                (acc, kbSession) => ({ ...acc, ...kbSession }),
                {} as K
            ),
            trackAction: (action: RunHistoryAction) => this.queueAction(action),
            channel: {
                requireApproval: this.channel.require_approval ?? false,
            },
        };


        return baseContext;
    }

    private buildUserMessage(inputEvent: InputEvent): (AgentInputText | AgentInputImage)[] {
        const textContent = this.buildTextContent(inputEvent);
        const content: (AgentInputText | AgentInputImage)[] = [{ type: 'input_text', text: textContent }];

        const imageUrls = inputEvent.getImageUrls();
        for (const imageUrl of imageUrls) {
            content.push({ type: 'input_image', image: imageUrl });
        }

        logger.info("User message build to be sent to agent", { content: JSON.stringify(content, null, 2) });

        return content;
    }

    private buildTextContent(inputEvent: InputEvent): string {
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
${formatChannelOutputsForAgent(this.channel.outputs as ChannelOutput[])}
</OUTPUT_DESTINATION>

<EVENT>
${inputEvent.formatForChannelAgent()}
</EVENT>
        `.trim();
    }

    private async processStream<TSession extends Session = Session, TAgent extends Agent<any, any> = Agent<Session, any>>(
        result: StreamedRunResult<TSession, TAgent>,
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

    private async processWithStreaming<TSession extends Session = Session, TAgent extends Agent<any, any> = Agent<Session, any>>(
        result: StreamedRunResult<TSession, TAgent>,
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

    private async processWithLogging<TSession extends Session = Session, TAgent extends Agent<any, any> = Agent<Session, any>>(
        result: StreamedRunResult<TSession, TAgent>
    ): Promise<void> {
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
                            type: RunHistoryActionType.update,
                            isReadOnly: false,
                        };

                        await this.notificationManager.notifyApprovalRequest(this.runContext.runId, approvalAction);
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

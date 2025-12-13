import { Agent, AgentInputItem, AgentOutputType, Tool, RunResult, RunState, RunToolApprovalItem, Runner, run } from '@openai/agents';
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
import type { RunHistoryAction, RunHistoryStreamingParams } from '../../shared/RunHistoryTypes';
import { EntityType } from '../../shared/Entities';
import { ChangedItem, ChangeEventType } from '../../shared/ModelEvents';
import { persistRunAction } from './EventProcessor';
import { processModelEventStream } from './StreamProcessor';
import { recentHistoryCallback, RunHistoryChatMemorySession } from '../CustomMemorySession';
import { IntegrationType } from '../../shared/Integrations';
import { InputImageContent, InputTextContent } from 'openai/resources/conversations/conversations.mjs';
import { runnerFactory } from '../runner';
import { NotificationManager } from '../../notifications/Notification';
import { persistOutputAttributions } from './persistOutputAttributions';


export class ChannelAgent<T extends Session, TConfig extends ConfigInstance> {
    private history: AgentInputItem[] = [];
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

    constructor(
        session: T, 
        output: Output<T, TConfig>, 
        channel: ChannelWithRelations, 
        runContext: RunContext,
        maxTurns: number = 50
    ) {
        this.history = [];
        this.session = session;
        this.output = output;
        this.channel = channel;
        this.tools = output.toolbox.map(entry => entry.tool);
        this.runContext = runContext;
        this.buildToolMetadataMap();
        this.memorySession = new RunHistoryChatMemorySession({
            sessionId: runContext.runId,
        });
        if(!maxTurns || maxTurns < 1) {
            throw new Error("Max turns must be greater than 0");
        }
        this.maxTurns = maxTurns;
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

        return this.buildResult(result);
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

        return this.buildResult(result);
    }

    private buildUserHistory(userMessage: string | (InputTextContent | InputImageContent)[]): AgentInputItem[] {
        // Directives are now included in the system prompt via SystemPromptBuilder.buildDirectivesSection()
        // to avoid accumulating duplicate directive entries in session history on each conversation turn.
        return [{ role: 'user' as const, content: userMessage }];
    }

    async resume(
        serializedState: string,
        decision: Decision,
        interruption: RunToolApprovalItem,
    ): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        await this.initializeAgent();

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before resume()");
        }

        const state = await RunState.fromString(this.agent, serializedState);

        if (decision === 'approve') {
            state.approve(interruption);
        } else {
            state.reject(interruption);
        }

        const result = await run(this.agent, state);
        return this.buildResult(result);
    }

    setInputEvent(event: InputEvent): void {
        this.inputEvent = event;
    }

    queueAction(action: RunHistoryAction): void {
        this.pendingActions.push(action);
    }

    async flushPendingActions(stepId: string, toolName: string): Promise<ChangedItem[]> {
        const notificationManager = new NotificationManager(this.session.user, this.channel);
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
            await notificationManager.notify(action);

            // Persist output attributions if:
            // 1. Input event is Identifiable
            // 2. Action has output_items populated
            // 3. Action is not read-only (track both write and read actions per user request)
            const sourceItemRef = this.inputEvent?.getIdentifiableInfo();
            if (sourceItemRef && action.output_items && action.output_items.length > 0 && !isReadOnly) {
                await persistOutputAttributions(
                    this.channel.id,
                    sourceItemRef,
                    action
                );
            }
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
            console.log(`${event.type} %o`, event.data);
        } else if (event.type === 'agent_updated_stream_event') {
            console.log(`${event.type} %s`, event.agent.name);
        } else if (event.type === 'run_item_stream_event') {
            console.log(`${event.type} %o`, event.item);
        }
    }

    private buildResult(result: any): ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>> {
        const hasInterruptions = result.interruptions && result.interruptions.length > 0;

        if (hasInterruptions) {
            return {
                status: 'awaiting_approval',
                state: result.state,
                interruptions: result.interruptions,
            };
        }

        return {
            status: 'completed',
            result,
        };
    }
}

export type SessionWithTracking<T extends Session> = T & {
    trackAction(action: RunHistoryAction): void;
}

export type ApprovalResult<T extends Session, AgentType extends Agent<T, AgentOutputType>> =
    | { status: 'completed'; result: RunResult<T, AgentType> }
    | { status: 'awaiting_approval'; state: RunState<T, AgentType>; interruptions: RunToolApprovalItem[] };

export type Decision = 'approve' | 'reject';

type ToolMetadata = {
    integration: IntegrationType;
    isReadOnly: boolean;
};

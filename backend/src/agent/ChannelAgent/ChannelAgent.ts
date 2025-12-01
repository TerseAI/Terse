import { Agent, AgentInputItem, run, AgentOutputType, Tool, RunResult, RunState, RunToolApprovalItem } from '@openai/agents';
import { Session } from '../../server';
import { systemPrompt } from './SystemPrompt';
import { InputEvent } from '../../integrations/abstract/InputEvent';
import { Output } from '../../outputs/abstract/Output';
import { ChannelInput, ChannelOutput, ChannelPrompt, ChannelWithRelations } from '../../types/prisma';
import { ConfigInstance } from '../../shared/Configs';
import { settings } from '../../config/settings';
import { formatChannelInputsForAgent, formatChannelOutputForAgent } from './formatContext';
import { UserFormatter } from '../../utility/UserFormatter';
import { transformAgentStreamToModelEvents } from '../streaming';
import { convertOutputConfigTypeToIntegrationType } from '../../utility/typeConverters';
import { getRealtimeSocket } from '../../realtimeSocket';
import type { RunHistoryAction, RunHistoryStreamingParams } from '../../shared/RunHistoryTypes';
import { EntityType } from '../../shared/Entities';
import { ChangedItem, ChangeEventType } from '../../shared/ModelEvents';
import { persistRunAction } from './EventProcessor';
import { processModelEventStream } from './StreamProcessor';


export class ChannelAgent<T extends Session, TConfig extends ConfigInstance> {
    private history: AgentInputItem[] = [];
    private session: T;
    private inputEvent: InputEvent | null = null;
    private channel: ChannelWithRelations;
    private channelPrompt: ChannelPrompt;
    private channelInputs: ChannelInput[];
    private channelOutput: ChannelOutput;
    private output: Output<T, TConfig>;
    private agent?: Agent<SessionWithTracking<T>, AgentOutputType>;
    private tools: Tool<SessionWithTracking<T>>[] = [];
    private runId: string;
    private toolToIntegrationMap: Map<string, string> = new Map();
    private pendingActions: RunHistoryAction[] = [];

    constructor(session: T, output: Output<T, TConfig>, channel: ChannelWithRelations, runId: string) {
        this.history = [];
        this.session = session;
        this.output = output;
        this.channel = channel;
        this.channelPrompt = channel.prompt as ChannelPrompt;
        this.channelInputs = channel.inputs as ChannelInput[];
        this.channelOutput = channel.output as ChannelOutput;
        this.tools = output.toolbox.map(entry => entry.tool);
        this.runId = runId;
        this.buildToolIntegrationMap();
    }

    async run(streamingParams?: RunHistoryStreamingParams): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        console.log("Running Channel Agent");
        await this.initializeAgent();

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before run()");
        }
        if (!this.inputEvent) {
            throw new Error("No input event set. Call setInputEvent() before run()");
        }

        const userMessage = this.buildUserMessage();
        this.history.push({ role: 'user', content: userMessage });

        const result = await run(this.agent, this.history, {
            context: this.getToolContext(),
            stream: true,
        });

        console.log('🔍 Result', result);

        await this.processStream(result, streamingParams);

        return this.buildResult(result);
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

    async flushPendingActions(stepId: string): Promise<ChangedItem[]> {
        const changedItems: ChangedItem[] = [];

        for (const action of this.pendingActions) {
            const actionId = await persistRunAction(this.runId, this.channel, this.session, {
                ...action,
                step_id: stepId,
            });
            if (actionId) {
                changedItems.push({
                    type_name: EntityType.RUN_HISTORY_ACTION,
                    id: actionId,
                    change_event_type: ChangeEventType.ACTION_EXECUTED
                });
            }
        }

        this.pendingActions = [];
        return changedItems;
    }

    private buildToolIntegrationMap(): void {
        const integrationType = convertOutputConfigTypeToIntegrationType(this.output.integration);
        this.output.toolbox.forEach(entry => {
            this.toolToIntegrationMap.set(entry.tool.name, integrationType);
        });
    }

    private chooseModel(): string {
        return settings.nodeEnv === 'development' ? 'gpt-5-mini' : 'gpt-5';
    }

    async initializeAgent(): Promise<void> {
        const outputInstructions = this.output.getSystemInstructions(this.session);
        const fullSystemPrompt = outputInstructions
            ? `${systemPrompt}\n\n${outputInstructions}`
            : systemPrompt;

        this.agent = new Agent<SessionWithTracking<T>, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: fullSystemPrompt,
            model: this.chooseModel(),
            tools: this.tools
        });
    }

    private getToolContext(): SessionWithTracking<T> {
        return {
            ...this.session,
            trackAction: (action: RunHistoryAction) => this.queueAction(action),
        };
    }

    private buildUserMessage(): any[] {
        const textContent = this.buildTextContent();
        const content: any[] = [{ type: 'input_text', text: textContent }];

        const imageUrls = this.inputEvent!.getImageUrls();
        for (const imageUrl of imageUrls) {
            content.push({ type: 'input_image', image: imageUrl });
        }

        return content;
    }

    private buildTextContent(): string {
        return `
<USER_CONTEXT>
${UserFormatter.formatForAgent(this.session.user)}
</USER_CONTEXT>

<USER_INSTRUCTIONS>
${this.channelPrompt.content || 'No instructions provided'}
</USER_INSTRUCTIONS>

<CHANNEL_INPUTS>
${formatChannelInputsForAgent(this.channelInputs)}
</CHANNEL_INPUTS>

<OUTPUT_DESTINATION>
${formatChannelOutputForAgent(this.channelOutput)}
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
            toolToIntegrationMap: this.toolToIntegrationMap,
            onToolCallComplete: (callId) => this.flushPendingActions(callId),
        });

        await processModelEventStream(eventStream, {
            runId: streamingParams.runId!,
            userId: streamingParams.userId!,
            channelId: streamingParams.channelId!,
            io,
        });
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

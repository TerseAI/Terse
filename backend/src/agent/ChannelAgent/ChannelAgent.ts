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
import { toChannelAgentEventStream, toEventStream } from '../streaming';
import { convertOutputConfigTypeToIntegrationType } from '../../utility/typeConverters';
import { storeChatEvent } from './runHistory';
import { getRealtimeSocket } from '../../realtimeSocket';
import type { RunHistoryAction, RunHistoryModelEvent, RunHistoryModelSocketEvent, RunHistoryStreamingParams } from '../../shared/RunHistoryTypes';
import { EntityType } from '../../shared/Entities';
import { ChangedItem, ChangeEventType } from '../../shared/ModelEvents';
import { persistRunAction } from './EventProcessor';



export type SessionWithTracking<T extends Session> = T & {
    trackAction(action: RunHistoryAction): void;
}


export type ApprovalResult<T extends Session, AgentType extends Agent<T, AgentOutputType>> =
    | {
        status: 'completed';
        result: RunResult<T, AgentType>;
    }
    | {
        status: 'awaiting_approval';
        state: RunState<T, AgentType>;
        interruptions: RunToolApprovalItem[];
    };

export type Decision = 'approve' | 'reject';

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
        // Build tool-to-integration mapping
        const integrationType = convertOutputConfigTypeToIntegrationType(output.integration);
        const integrationString = integrationType; // IntegrationType enum values are strings
        output.toolbox.forEach(entry => {
            this.toolToIntegrationMap.set(entry.tool.name, integrationString);
        });
    }

    chooseChannelAgentModel(): string {
        const nodeEnv = settings.nodeEnv;
        if (nodeEnv === 'development') {
            return 'gpt-5-mini';
        }
        return 'gpt-5';
    }

    /**
     * Queue an action to be persisted when we receive the step_id from ToolCallComplete.
     * Actions are not persisted immediately - they wait until flushPendingActions is called.
     */
    queueAction(action: RunHistoryAction): void {
        this.pendingActions.push(action);
    }

    /**
     * Flush all pending actions, associating them with the given step_id.
     * Called when ToolCallComplete event is received in the streaming layer.
     */
    async flushPendingActions(stepId: string): Promise<ChangedItem[]> {
        const changedItems: ChangedItem[] = [];
        
        for (const action of this.pendingActions) {
            const result = await persistRunAction(this.runId, this.channel, this.session, {
                ...action,
                step_id: stepId,
            });
            if (result) {
                changedItems.push({
                    type_name: EntityType.RUN_HISTORY_ACTION,
                    id: result,
                    change_event_type: ChangeEventType.ACTION_EXECUTED
                });
            }
        }
        
        this.pendingActions = [];
        return changedItems;
    }
    
    getToolContext(): SessionWithTracking<T> {
        return {
            ...this.session,
            trackAction: (action: RunHistoryAction) => this.queueAction(action),
        }
    }

    async initializeAgent(): Promise<void> {
        // Get output-specific system instructions
        const outputInstructions = this.output.getSystemInstructions(this.session);
        const fullSystemPrompt = outputInstructions
            ? `${systemPrompt}\n\n${outputInstructions}`
            : systemPrompt;

        const agent = new Agent<SessionWithTracking<T>, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: fullSystemPrompt,
            model: this.chooseChannelAgentModel(),
            tools: this.tools
        });

        this.agent = agent;
    }

    setInputEvent(event: InputEvent) {
        this.inputEvent = event;
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

        const structuredUserText = `
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
      ${this.inputEvent.formatForChannelAgent()}
      </EVENT>
        `.trim();

        const content: any[] = [
            {
                type: 'input_text',
                text: structuredUserText,
            },
        ];

        const imageUrls = this.inputEvent.getImageUrls();
        for (const imageUrl of imageUrls) {
            content.push({
                type: 'input_image',
                image: imageUrl,
            });
        }

        this.history.push({
            role: 'user',
            content,
        });

        const result = await run(this.agent, this.history, {
            context: this.getToolContext(),
            stream: true,
        });

        // Stream events if streamingParams is provided with all required fields
        if (streamingParams?.runId && streamingParams?.userId && streamingParams?.channelId) {
            const io = getRealtimeSocket();
            const userRoom = `user:${streamingParams.userId}`;

            // Accumulate TextDelta events by step_id
            const accumulatedDeltas = new Map<string, { text: string; firstTimestamp: string; eventId?: string }>();
            let lastTextDeltaStepId: string | null = null;

            try {
                for await (const modelEvent of toChannelAgentEventStream(result, this, this.toolToIntegrationMap)) {
                    const timestamp = new Date().toISOString();

                    // Handle TextDelta accumulation
                    if (modelEvent.type === 'TextDelta') {
                        const { step_id, delta } = modelEvent;

                        // If we've moved to a new step_id, store the previous accumulated message
                        if (lastTextDeltaStepId && lastTextDeltaStepId !== step_id && accumulatedDeltas.has(lastTextDeltaStepId)) {
                            const accumulated = accumulatedDeltas.get(lastTextDeltaStepId)!;
                            const finalEvent = {
                                type: 'TextDelta' as const,
                                step_id: lastTextDeltaStepId,
                                delta: accumulated.text,
                            };
                            const eventId = await storeChatEvent(streamingParams.runId, finalEvent);
                            accumulated.eventId = eventId;
                        }

                        // Accumulate the delta
                        if (!accumulatedDeltas.has(step_id)) {
                            accumulatedDeltas.set(step_id, { text: delta, firstTimestamp: timestamp });
                        } else {
                            const accumulated = accumulatedDeltas.get(step_id)!;
                            accumulated.text += delta;
                        }
                        lastTextDeltaStepId = step_id;

                        // Always emit the delta via Socket.IO for real-time display
                        if (io) {
                            const runHistoryModelEvent: RunHistoryModelEvent = {
                                ...modelEvent,
                                id: accumulatedDeltas.get(step_id)?.eventId || '',
                                timestamp,
                            };
                            const payload: RunHistoryModelSocketEvent = {
                                runId: streamingParams.runId,
                                channelId: streamingParams.channelId,
                                runHistoryModelEvent,
                            };
                            io.to(userRoom).emit('channel:chat:event', payload);
                        }
                    } else {
                        // For non-TextDelta events, store immediately
                        const eventId = await storeChatEvent(streamingParams.runId, modelEvent);

                        // Emit event via Socket.IO with timestamp and ID
                        if (io) {
                            const runHistoryModelEvent: RunHistoryModelEvent = {
                                ...modelEvent,
                                id: eventId,
                                timestamp,
                            };
                            const payload: RunHistoryModelSocketEvent = {
                                runId: streamingParams.runId,
                                channelId: streamingParams.channelId,
                                runHistoryModelEvent,
                            };
                            io.to(userRoom).emit('channel:chat:event', payload);
                        }
                    }
                }

                // Store any remaining accumulated TextDelta events
                if (lastTextDeltaStepId && accumulatedDeltas.has(lastTextDeltaStepId)) {
                    const accumulated = accumulatedDeltas.get(lastTextDeltaStepId)!;
                    if (!accumulated.eventId) {
                        const finalEvent = {
                            type: 'TextDelta' as const,
                            step_id: lastTextDeltaStepId,
                            delta: accumulated.text,
                        };
                        await storeChatEvent(streamingParams.runId, finalEvent);
                    }
                }
            } catch (error) {
                console.error('Error streaming channel agent events:', error);

                // Even on error, try to store any accumulated TextDelta events
                if (lastTextDeltaStepId && accumulatedDeltas.has(lastTextDeltaStepId)) {
                    const accumulated = accumulatedDeltas.get(lastTextDeltaStepId)!;
                    if (!accumulated.eventId) {
                        try {
                            const finalEvent = {
                                type: 'TextDelta' as const,
                                step_id: lastTextDeltaStepId,
                                delta: accumulated.text,
                            };
                            await storeChatEvent(streamingParams.runId, finalEvent);
                        } catch (storeError) {
                            console.error('Error storing accumulated TextDelta on error:', storeError);
                        }
                    }
                }

                // Continue with normal flow even if streaming fails
            }
        } else {
            // If not streaming, just iterate through events for logging
            for await (const event of result) {
                // these are the raw events from the model
                if (event.type === 'raw_model_stream_event') {
                    console.log(`${event.type} %o`, event.data);
                }
                // agent updated events
                if (event.type === 'agent_updated_stream_event') {
                    console.log(`${event.type} %s`, event.agent.name);
                }
                // Agent SDK specific events
                if (event.type === 'run_item_stream_event') {
                    console.log(`${event.type} %o`, event.item);
                }
            }
        }

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

    async resume(
        serializedState: string,
        decision: Decision,
        interruption: RunToolApprovalItem,
    ): Promise<ApprovalResult<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>>> {
        await this.initializeAgent();

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before resume()");
        }

        // Deserialize the saved state
        const state: RunState<SessionWithTracking<T>, Agent<SessionWithTracking<T>, AgentOutputType>> = await RunState.fromString(this.agent, serializedState);

        // Apply the user's decision
        if (decision === 'approve') {
            state.approve(interruption);
        } else {
            state.reject(interruption);
        }

        // Resume execution
        const result = await run(this.agent, state);

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
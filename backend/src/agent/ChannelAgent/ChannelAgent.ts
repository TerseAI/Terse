import { Agent, AgentInputItem, run, AgentOutputType, Tool, RunResult, RunState, RunToolApprovalItem } from '@openai/agents';
import { Session } from '../../server';
import { systemPrompt } from './SystemPrompt';
import { InputEvent } from '../../integrations/abstract/InputEvent';
import { Output } from '../../outputs/abstract/Output';
import { ChannelInput, ChannelOutput, ChannelPrompt } from '../../types/prisma';
import { ConfigInstance } from '../../shared/Configs';
import { settings } from '../../config/settings';
import { formatChannelInputsForAgent, formatChannelOutputForAgent } from './formatContext';
import { UserFormatter } from '../../utility/UserFormatter';
import { toEventStream } from '../streaming';
import { storeChatEvent } from './runHistory';
import { getRealtimeSocket } from '../../realtimeSocket';
import type { RunHistoryModelEvent, RunHistoryModelSocketEvent, RunHistoryStreamingParams } from '../../shared/RunHistoryTypes';

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
    private channelPrompt: ChannelPrompt;
    private channelInputs: ChannelInput[];
    private channelOutput: ChannelOutput;
    private output: Output<T, TConfig>;
    private agent?: Agent<T, AgentOutputType>;
    private tools: Tool<T>[] = [];

    constructor(session: T, output: Output<T, TConfig>, channelPrompt: ChannelPrompt, channelInputs: ChannelInput[], channelOutput: ChannelOutput) {
        this.history = [];
        this.session = session;
        this.output = output;
        this.channelPrompt = channelPrompt;
        this.channelInputs = channelInputs;
        this.channelOutput = channelOutput;
        this.tools = output.toolbox.map(entry => entry.tool);
    }

    chooseChannelAgentModel(): string {
        const nodeEnv = settings.nodeEnv;
        if (nodeEnv === 'development') {
            return 'gpt-5-mini';
        }
        return 'gpt-5';
    }

    async initializeAgent(): Promise<void> {
        // Get output-specific system instructions
        const outputInstructions = this.output.getSystemInstructions(this.session);
        const fullSystemPrompt = outputInstructions 
            ? `${systemPrompt}\n\n${outputInstructions}`
            : systemPrompt;

        const agent = new Agent<T, AgentOutputType>({
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

    async run(streamingParams?: RunHistoryStreamingParams): Promise<ApprovalResult<T, Agent<T, AgentOutputType>>> {
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
          context: this.session as T,
          stream: true,
        });

        // Stream events if streamingParams is provided with all required fields
        if (streamingParams?.runId && streamingParams?.userId && streamingParams?.channelId) {
            const io = getRealtimeSocket();
            const userRoom = `user:${streamingParams.userId}`;
            
            try {
                for await (const modelEvent of toEventStream(result, undefined)) {
                    // Store event in database and get the ID
                    const eventId = await storeChatEvent(streamingParams.runId, modelEvent);
                    
                    // Emit event via Socket.IO with timestamp and ID
                    if (io) {
                        const runHistoryModelEvent: RunHistoryModelEvent = {
                            ...modelEvent,
                            id: eventId,
                            timestamp: new Date().toISOString(),
                        };
                        const payload: RunHistoryModelSocketEvent = {
                            runId: streamingParams.runId,
                            channelId: streamingParams.channelId,
                            runHistoryModelEvent,
                        };
                        io.to(userRoom).emit('channel:chat:event', payload);
                    }
                }
            } catch (error) {
                console.error('Error streaming channel agent events:', error);
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
    ): Promise<ApprovalResult<T, Agent<T, AgentOutputType>>> {
        await this.initializeAgent();

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before resume()");
        }

        // Deserialize the saved state
        const state: RunState<T, Agent<T, AgentOutputType>> = await RunState.fromString(this.agent, serializedState);

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
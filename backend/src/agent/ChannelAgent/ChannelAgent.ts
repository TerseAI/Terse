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
    private agent?: Agent<T, AgentOutputType>;
    private tools: Tool<T>[] = [];

    constructor(session: T, output: Output<T, TConfig>, channelPrompt: ChannelPrompt, channelInputs: ChannelInput[], channelOutput: ChannelOutput) {
        this.history = [];
        this.session = session;
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
        const agent = new Agent<T, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: systemPrompt,
            model: this.chooseChannelAgentModel(),
            tools: this.tools
        });

        this.agent = agent;
    }

    setInputEvent(event: InputEvent) {
        this.inputEvent = event;
    }

    async run(): Promise<ApprovalResult<T, Agent<T, AgentOutputType>>> {
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
        });
      
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
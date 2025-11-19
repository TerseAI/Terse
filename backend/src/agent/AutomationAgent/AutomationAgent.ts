import { Agent, AgentInputItem, run, AgentOutputType, Tool, RunResult, RunState, RunToolApprovalItem } from '@openai/agents';
import { Session } from '../../server';
import { systemPrompt } from './SystemPrompt';
import { InputEvent } from '../../integrations/abstract/InputEvent';
import { Output } from '../../outputs/abstract/Output';
import { AutomationInput, AutomationOutput, AutomationPrompt } from '../../types/prisma';
import { ConfigInstance } from 'src/shared/Configs';

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

export class AutomationAgent<T extends Session, TConfig extends ConfigInstance> {
    private history: AgentInputItem[] = [];
    private session: T;
    private inputEvent: InputEvent | null = null;
    private automationPrompt: AutomationPrompt;
    private automationInputs: AutomationInput[];
    private automationOutput: AutomationOutput;
    private agent?: Agent<T, AgentOutputType>;
    private tools: Tool<T>[] = [];

    constructor(session: T, output: Output<T, TConfig>, automationPrompt: AutomationPrompt, automationInputs: AutomationInput[], automationOutput: AutomationOutput) {
        this.history = [];
        this.session = session;
        this.automationPrompt = automationPrompt;
        this.automationInputs = automationInputs;
        this.automationOutput = automationOutput;
        this.tools = output.toolbox.map(entry => entry.tool);
    }

    chooseAutoamationAgentModel(): string {
        // if we are local dev, use cheaper model
        if (process.env.NODE_ENV === 'development') {
            return 'gpt-4o-mini';
        }
        return 'gpt-5';
    }

    async initializeAgent(): Promise<void> {
        const agent = new Agent<T, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: await systemPrompt(this.session, this.automationPrompt, this.automationInputs, this.automationOutput),
            model: this.chooseAutoamationAgentModel(),
            tools: this.tools
        });

        this.agent = agent;
    }

    setInputEvent(event: InputEvent) {
        this.inputEvent = event;
    }

    async run(): Promise<ApprovalResult<T, Agent<T, AgentOutputType>>> {
        console.log("Running Automation Agent");

        await this.initializeAgent();

        if (!this.agent) {
            throw new Error("Agent not initialized. Call initializeAgent() before run()");
        }
        
        if (this.inputEvent) {
            const content: any[] = [
                {
                    type: 'input_text',
                    text: this.inputEvent.formatForAutomationAgent()
                }
            ];
            const imageUrls = this.inputEvent.getImageUrls();
            if (imageUrls.length > 0) {
                for (const imageUrl of imageUrls) {
                    content.push({
                        type: 'input_image',
                        image: imageUrl
                    });
                }
            }
            this.history.push({
                role: 'user',
                content: content
            });
        } else {
            throw new Error("No input event set. Call setInputEvent() before run()");
        }

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
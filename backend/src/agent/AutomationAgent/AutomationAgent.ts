import { Agent, AgentInputItem, run, AgentOutputType, Tool, RunResult, RunState, RunToolApprovalItem } from '@openai/agents';
import { Session } from '../../server';
import { systemPrompt } from './SystemPrompt';
import { InputEvent } from '../../Updater/InputEvents';
import { Output } from '../../Updater/Outputs/Output';
import { AutomationInput, AutomationOutput, AutomationPrompt } from '../../types/prisma';

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

export class AutomationAgent<T extends Session> {
    private history: AgentInputItem[] = [];
    private session: T;
    private inputEvent: InputEvent | null = null;
    private automationPrompt: AutomationPrompt;
    private automationInputs: AutomationInput[];
    private automationOutput: AutomationOutput;
    private agent?: Agent<T, AgentOutputType>;
    private tools: Tool<T>[] = [];

    constructor(session: T, output: Output<T>, automationPrompt: AutomationPrompt, automationInputs: AutomationInput[], automationOutput: AutomationOutput) {
        this.history = [];
        this.session = session;
        this.automationPrompt = automationPrompt;
        this.automationInputs = automationInputs;
        this.automationOutput = automationOutput;
        this.tools = output.toolbox;
    }

    async initializeAgent(): Promise<void> {
        const agent = new Agent<T, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: await systemPrompt(this.session, this.automationPrompt, this.automationInputs, this.automationOutput),
            model: 'gpt-5',
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

        console.log("Input Event:", this.inputEvent);

        // Add the input event as the initial message to the history
        if (this.inputEvent) {
            // For Figma comments with images, format using OpenAI's image_url format
            if (this.inputEvent.integrationType === 'FIGMA' && 'data' in this.inputEvent) {
                const figmaEvent = this.inputEvent as any;
                const imageUrls = figmaEvent.data?.imageUrls;
                
                if (imageUrls && (imageUrls.nodeImage || imageUrls.contextImage || imageUrls.fullFrame)) {
                    // Build content array with text and images using Agents SDK format
                    const content: any[] = [
                        {
                            type: 'input_text',
                            text: this.inputEvent.formatForAutomationAgent()
                        }
                    ];
                    
                    // Add images if available (Figma provides URLs that are valid for OpenAI)
                    // image can be a string URL or { id: string }
                    if (imageUrls.nodeImage) {
                        content.push({
                            type: 'input_image',
                            image: imageUrls.nodeImage
                        });
                    }
                    if (imageUrls.contextImage) {
                        content.push({
                            type: 'input_image',
                            image: imageUrls.contextImage
                        });
                    }
                    if (imageUrls.fullFrame) {
                        content.push({
                            type: 'input_image',
                            image: imageUrls.fullFrame
                        });
                    }
                    
                    this.history.push({
                        role: 'user',
                        content: content
                    });
                } else {
                    // No images, use text-only format
                    this.history.push({
                        role: 'user',
                        content: this.inputEvent.formatForAutomationAgent()
                    });
                }
            } else {
                // Non-Figma event or event without images
                this.history.push({
                    role: 'user',
                    content: this.inputEvent.formatForAutomationAgent()
                });
            }
        } else {
            throw new Error("No input event set. Call setInputEvent() before run()");
        }

        console.log("History:", this.history);

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
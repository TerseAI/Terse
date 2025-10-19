import { Agent, AgentInputItem, run, AgentOutputType, Tool, RunResult } from '@openai/agents';
import { Session } from '../../server';
import { systemPrompt } from './SystemPrompt';
import { InputEvent } from '../../Updater/InputEvents';
import { Output } from '../../Updater/Outputs/Output';
import { AutomationInput, AutomationOutput, AutomationPrompt } from '../../types/prisma';

export class AutomationAgent<T extends Session> {
    private history: AgentInputItem[] = [];
    private session: T;
    private inputEvent: InputEvent | null = null;
    private automationPrompt: AutomationPrompt;
    private automationInputs: AutomationInput[];
    private automationOutput: AutomationOutput;
    agent?: Agent<T, AgentOutputType>;
    private tools: Tool<T>[] = [];

    constructor(session: T, output: Output<T>, automationPrompt: AutomationPrompt, automationInputs: AutomationInput[], automationOutput: AutomationOutput) {
        this.history = [];
        this.session = session;
        this.automationPrompt = automationPrompt;
        this.automationInputs = automationInputs;
        this.automationOutput = automationOutput;
        this.tools = output.toolbox;
    }

    setInputEvent(event: InputEvent) {
        this.inputEvent = event;
    }

    async run(): Promise<RunResult<T, Agent<T, AgentOutputType>>> {
        console.log("Running Automation Agent");

        // Add the input event as the initial message to the history
        if (this.inputEvent) {
            this.history.push({
                role: 'user',
                content: JSON.stringify(this.inputEvent, null, 2)
            });
        } else {
            throw new Error("No input event set. Call setInputEvent() before run()");
        }

        const agent = new Agent<T, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: await systemPrompt(this.session, this.automationPrompt, this.automationInputs, this.automationOutput),
            model: 'gpt-5',
            tools: this.tools
        });

        this.agent = agent;

        const result = await run(agent, this.history, {
            context: this.session as T,
        });

        return result;
    }
}
import { Agent, AgentInputItem, run, AgentOutputType, Tool, RunResult } from '@openai/agents';
import { Session } from '../../server';
import { ToolBox } from '../agents/Agent';
import { systemPrompt } from './SystemPrompt';
import { InputEvent } from '../../Updater/InputEvents';
import { Output } from '../../Updater/Outputs/Output';
import { AutomationPrompt } from '../../types/prisma';
export class AutomationAgent {
    private history: AgentInputItem[] = [];
    private session: Session;
    private toolBox: ToolBox;
    private inputEvent: InputEvent | null = null;
    private automationPrompt: AutomationPrompt;
    agent?: Agent<any, AgentOutputType>;

    constructor(session: Session, output: Output, automationPrompt: AutomationPrompt) {
        this.history = [];
        this.session = session;
        this.automationPrompt = automationPrompt;
        this.toolBox = new ToolBox();
    }

    setInputEvent(event: InputEvent) {
        this.inputEvent = event;
    }

    async run(): Promise<RunResult<Session, Agent<Session, AgentOutputType>>> {
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

        const agent = new Agent<Session, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: await systemPrompt(this.session, this.automationPrompt),
            model: 'gpt-4o',
            tools: []
        });

        this.agent = agent;

        const result = await run(agent, this.history, {
            context: this.session,
        });

        return result;
    }
}
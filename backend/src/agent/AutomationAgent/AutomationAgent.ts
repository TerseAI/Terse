import { Agent, AgentInputItem, run, AgentOutputType, Tool, RunResult } from '@openai/agents';
import { Session } from '../../server';
import { ToolBox } from '../agents/Agent';
import { systemPrompt } from './SystemPrompt';
import { InputEvent } from '../../Updater/InputEvents';
import { Output } from '../../Updater/Outputs/Output';

export class AutomationAgent {
    private history: AgentInputItem[] = [];
    private session: Session;
    private toolBox: ToolBox;
    private inputEvent: InputEvent | null = null;
    agent?: Agent<any, AgentOutputType>;

    constructor(session: Session, output: Output) {
        this.history = [];
        this.session = session;
        this.toolBox = new ToolBox();
    }

    setInputEvent(event: InputEvent) {
        this.inputEvent = event;
    }

    async run(): Promise<RunResult<Session, Agent<Session, AgentOutputType>>> {
        console.log("Running Automation Agent");

        const agent = new Agent<Session, AgentOutputType>({
            name: 'LLM ticket manager',
            instructions: await systemPrompt(this.session),
            model: 'gpt-4o',
            tools: []
        });

        this.agent = agent;

        const result = await run(agent, this.history, {
            stream: true,
            context: this.session,
        });

        return result;
    }
}
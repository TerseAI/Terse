import { Agent, AgentInputItem, AgentOutputType, run, RunResult, user } from "@openai/agents";
import { ToolBox } from "./Agent";
import { Session } from "../../server";
import { SendModelRequest } from "src/shared/ModelEvents";
import { systemPrompt } from "../systemPrompt";

export class Analyzer {
    private history: AgentInputItem[] = [];
    private session: Session;
    private toolBox: ToolBox;
    agent?: Agent<Session, AgentOutputType>;

    constructor(session: Session) {
        this.history = [];
        this.session = session;
        this.toolBox = new ToolBox();
    }

    async analyze(message: SendModelRequest) {
        this.history.push(user(message.user_message));
    }

    // There will be no follow up here. 
    async run(): Promise<RunResult<Session, Agent<Session, AgentOutputType>>> {
        const agent = new Agent<Session, AgentOutputType>({
            name: 'Change Analyzer',
            instructions: await systemPrompt(this.session),
            model: 'gpt-4o',
            tools: []
        });

        const result = await run(agent, this.history, {
            context: this.session,
        });

        return result;
    }
}
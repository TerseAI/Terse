import { Agent, AgentInputItem, AgentOutputType, run, RunResult, user } from "@openai/agents";
import { ToolBox } from "./Agent";
import { Session } from "../../server";
import { SendModelRequest } from "src/shared/ModelEvents";
import { ticketTools } from "../tools/ticketingTools";

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
            tools: [
                ...ticketTools
            ]
        });

        const result = await run(agent, this.history, {
            context: this.session,
        });

        return result;
    }
}

const systemPrompt = (session: Session) => {
    let current_user = session.currentUser;
    return `
    The current user is ${current_user}. Be sure to copy the user id exactly as it is if needed in a tool call.

    You are an expert at analyzing changes to code.
    You are given a list of changes to a codebase.
    You will also be given a list of tickets could be related to the codebase.
    
    Your job is to analyze the changes and the tickets and determine if the changes are related to the tickets.

    We have run a semantic search on the changes and may have found some tickets that are related to the changes.

    If they are, and the ticket is not marked as in progress, you should mark it as in progress.

    If there are no tickets that come up in the search. But the changes seem to indicate a bug fix, new feature or anything else that should be a ticket, you should create a ticket.

    You are an agent, but there is no follow up from the user. I am giving you the autonomy of calling whatever tools you need to.

    You can take your time as well, there is no UI Initiated follow up.
    `;
}
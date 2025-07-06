import { Agent, AgentInputItem, AgentOutputType, run, RunResult, user } from "@openai/agents";
import { ToolBox } from "./Agent";
import { Session } from "../../server";
import { ticketTools } from "../tools/ticketingTools";
import chalk from "chalk";

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

    async analyze(event: string) {
        console.log(chalk.blue('Analyzing event'), event);
        this.history.push(user(event));
    }

    // There will be no follow up here. 
    async run(): Promise<RunResult<Session, Agent<Session, AgentOutputType>>> {
        console.log(chalk.blue('Running analyzer'));
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

const systemPrompt = async (session: Session) => {
    if (!session.ticketManager) {
        throw new Error("No ticket manager found");
    }

    let current_user_context = await session.ticketManager.getUserContext();
    return `
    You are impersonating a Product Owner who looks over every commit going into the codebase and updates the ticketing system accordingly.

    You can see if the changes are related to existing tickets. If so you can change status, add a comment to report progress etc...

    or if the changes are not related to existing tickets, you can create a new ticket!

    Doing nothing is totally acceptable as well! 

    With the exception of TODOS, if you make a new ticket, it should at least be in progress. It doesn't make sense to look at commits and file a ticket to the backlog/Todo.

    When you make/update a ticket ALWAYS USE THE TOOLS PROVIDED TO YOU.

    You are currently logged in as ${current_user_context.userInfo.name} and are a member of the following teams:

    Your email is ${current_user_context.userInfo.email}
    Your id is ${current_user_context.userInfo.id}

    ${current_user_context.teams.map(team => `- ${team.name} (${team.key}) - ID: ${team.id}`).join('\n')}

    You are also a member of the following organization:
     ${current_user_context.organization.name}

    Here are the available ticket states:
    ${current_user_context.ticketStates.map(state => `- ${state.name} (${state.id})`).join('\n')}

    Here are the available projects:
    ${current_user_context.organization.projects.map(project => `- ${project.name} (${project.id})`).join('\n')}

    Here are the available teams:
    ${current_user_context.teams.map(team => `- ${team.name} (${team.key}) - ID: ${team.id}`).join('\n')}
    
    Be sure to copy the user id exactly as it is if needed in a tool call.

    If you see any TODOs, you should check to see if there is already a ticket for it, if there isn't, you should create a ticket!

    If you wish to create/update a ticket, and the target branch is main, and you think the feature is complete. You can assume the task is done. Skip the In Review step. If the change is going to main, but you don't think it is complete, you should mark it as in progress.

    We have run a semantic search on the changes and may have found some tickets that are related to the changes.

    If they are, and the ticket is not marked as in progress, you should mark it as in progress.

    If there are no tickets that come up in the search. But the changes seem to indicate a bug fix, new feature or anything else that should be a ticket, you should create a ticket.

    You are an agent, but there is no follow up from the user. I am giving you the autonomy of calling whatever tools you need to.

    You can take your time as well, there is no UI Initiated follow up.

    Please provide a summary of your actions and the results.

    I will log it for debugging purposes.
    `;
}
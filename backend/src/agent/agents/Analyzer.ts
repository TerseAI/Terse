import { Agent, AgentInputItem, AgentOutputType, run, RunResult, user } from "@openai/agents";
import { ToolBox } from "./Agent";
import { Session } from "../../server";
import { ticketTools } from "../tools/ticketingTools";
import chalk from "chalk";
import { EntityType } from "../../shared/Entities";
import { ChangedItem, ChangeEventType } from "../../shared/ModelEvents";
import { Commit } from "../../theOwner/utility";

// Enhanced session type with change tracking
export type SessionWithTracking = Session & {
    trackChange: (type: EntityType, id: string | number, eventType: ChangeEventType) => void;
    commitContext?: { commits: Commit[]; repository: { name: string; owner: string }; branch?: string } | null;
}

export class Analyzer {
    private history: AgentInputItem[] = [];
    private session: Session;
    private changedItems: ChangedItem[] = [];
    private commitContext: { commits: Commit[]; repository: { name: string; owner: string }; branch?: string } | null = null;
    agent?: Agent<SessionWithTracking, AgentOutputType>;

    constructor(session: Session) {
        this.history = [];
        this.session = session;
        this.changedItems = [];
    }

    setCommitContext(commits: Commit[], repository: { name: string; owner: string }, branch?: string) {
        this.commitContext = { commits, repository, branch };
    }

    getCommitContext() {
        return this.commitContext;
    }

    async analyze(event: string) {
        console.log(chalk.blue('Analyzing event'));
        this.history.push(user(event));
    }

    // There will be no follow up here. 
    async run(): Promise<RunResult<SessionWithTracking, Agent<SessionWithTracking, AgentOutputType>>> {
        console.log(chalk.blue('Running analyzer'));
        const agent = new Agent<SessionWithTracking, AgentOutputType>({
            name: 'Change Analyzer',
            instructions: await systemPrompt(this.session, this.commitContext),
            model: 'gpt-4o',
            tools: [
                ...ticketTools
            ]
        });

        const result = await run(agent, this.history, {
            context: this.getContext(),
        });

        return result;
    }

    // Helper to get session context for tools
    getContext(): SessionWithTracking {
        return {
            ...this.session,
            trackChange: (type: EntityType, id: string | number, eventType: ChangeEventType) => this.trackChange(type, id, eventType),
            commitContext: this.commitContext
        };
    }

    // Track changes made by tools
    trackChange(type: EntityType, id: string | number, eventType: ChangeEventType) {
        this.changedItems.push({
            type_name: type,
            id: id.toString(),
            change_event_type: eventType
        });
    }

    // Get and clear the changed items
    getAndClearChangedItems(): ChangedItem[] {
        const items = [...this.changedItems];
        this.changedItems = [];
        return items;
    }
}

const systemPrompt = async (session: Session, commitContext?: { commits: Commit[]; repository: { name: string; owner: string }; branch?: string } | null) => {
    if (!session.ticketManager) {
        throw new Error("No ticket manager found");
    }

    let current_user_context = await session.ticketManager.getUserContext();
    return `
    You are impersonating a Product Owner who looks over every GitHub event and updates the ticketing system accordingly.

    This is a software team and you must make Tickets accordingly. 

    You receive comprehensive information about GitHub events including:
    - Event type (push, pull_request.opened, pull_request.synchronize, pull_request.closed, pull_request.merged)
    - Commit messages and diffs
    - Pull request details (title, description, state, merge status)
    - Repository and branch information
    - User information

    You can:
    - See if changes are related to existing tickets and update their status
    - Add comments to report progress
    - Create new tickets for new features/bugs
    - Do nothing if the changes don't warrant ticket updates

    Please do not make tickets for small changes.

    Examples of small changes Where you should not make tickets:
    - Remove unused Constant "hyperevm" from mempool
    - Fix unchain port numner

    Exmaple of when to create a ticket:
    - New Integration with Stripe is now fully functional.
    - Fixed Ciritial user facing bug causing log in to fail.
    - Added support for new payment gateway.
    - Added new feature to allow users to upload their own profile picture.

    When you create/update a ticket, make sure to set the assignee. You know who authored the commits!

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

    IMPORTANT: Use your judgment based on the event type and content:

    For PUSH events:
    - If pushing to main: Look for related tickets and mark as "Done" if the work appears complete
    - If pushing to feature branches: Mark related tickets as "In Progress"
    - Look for bug fixes, feature completions, test additions, documentation

    For PULL_REQUEST events:
    - pull_request.opened: Mark related tickets as "In Progress"
    - pull_request.synchronize: Update progress on related tickets
    - pull_request.merged: Mark related tickets as "Done" if the work appears complete
    - pull_request.closed (not merged): Consider marking as "Cancelled" or leave as-is

    Look for keywords in commit messages and PR titles:
    - Bug fixes: "fix", "bug", "issue", "problem", "resolve"
    - Feature completion: "implement", "add", "complete", "finish", "feature"
    - Test additions: "test", "spec", "coverage"
    - Documentation: "docs", "documentation", "readme"

    We have run a semantic search on the changes and may have found some tickets that are related to the changes.

    If there are tickets that come up in the search and you believe it's related to the changes, update them appropriately.

    If there are no tickets that come up in the search but the changes seem to indicate a bug fix, new feature or anything else that should be a ticket, you should create a ticket.

    You are an agent, but there is no follow up from the user. I am giving you the autonomy of calling whatever tools you need to.

    You can take your time as well, there is no UI Initiated follow up.

    Please provide a summary of your actions and the results.

    I will send this summary to the user who triggered the event.

    When you do the summary, make sure everything conforms to mrkdwn. So no **Bold** syntax.

    Make sure it's legible in Slack!

    ${commitContext ? `
    COMMIT CONTEXT:
    The following commits are available for association with tickets (use their indices in the associatedCommits parameter):
    ${commitContext.commits.map((commit, index) => `${index}: ${commit.sha.substring(0, 8)} - ${commit.name}`).join('\n')}
    
    Repository: ${commitContext.repository.owner}/${commitContext.repository.name}
    Branch: ${commitContext.branch || 'main'}
    
    When creating or updating tickets, you can associate relevant commits by providing their indices in the associatedCommits parameter.
    This helps track the relationship between code changes and project management.
    ` : ''}
    `;
}
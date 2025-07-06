import { TicketManager } from "../ticketing/TicketIntegration";
import { Search } from "../search/search";
import { Analyzer } from "src/agent/agents/Analyzer";
import { Session } from "../server";
import chalk from "chalk";
import { SearchResult } from "src/search/SearchItem";
import { db } from "src/prismaClient";
import { sendMessage } from "src/slack/sendMessage";

class Owner {
    private ticketingSystem: TicketManager;
    private searchSystem: Search;
    private session: Session;

    constructor(ticketingSystem: TicketManager, searchSystem: Search, session: Session) {
        this.ticketingSystem = ticketingSystem;
        this.searchSystem = searchSystem;
        this.session = session;
    }

    async handlePushEvent(event: PushEvent) {
        console.log('The owner is handling a push event', event);
        const analyzer = new Analyzer(this.session);


        const results: SearchResult[][] = [];
        for (const commitString of pushEventToString(event)) {
            // Run semantic search on the push event
            const searchResults = await this.searchSystem.search(commitString, {
                teamId: this.session.teamId || '',
                entityTypes: ['ticket'],
                minSimilarity: 0.4,
                filters: [],
                limit: 10
            });

            console.log(chalk.blue('Search results for commit', commitString), searchResults);
            results.push(searchResults);
        }

        // flatten the results
        const flattenedResults = results.flat();
        // de-duplicate the results. Anything with the same entityId and entityType reference the same entity
        const uniqueResults = flattenedResults.filter((result, index, self) =>
            index === self.findIndex((t) => t.entityId === result.entityId && t.entityType === result.entityType)
        );

        // Run the analyzer
        analyzer.analyze(eventForAgent(event, uniqueResults));

        // Run the analyzer
        const result = await analyzer.run();

        console.log(chalk.blue('Analyzer result'), result.finalOutput);

        // get user slack integration
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: {
                user_id: this.session.user.id
            }
        });

        if (!userSlackIntegration) {
            console.error("User slack integration not found");
            return;
        }

        const slackIntegration = await db().slack_integrations.findFirst({
            where: {
                team_id: userSlackIntegration.slack_team_id
            }
        });

        if (!slackIntegration) {
            console.error("Slack integration not found");
            return;
        }

        if (!userSlackIntegration.dm_channel_id) {
            console.error("User slack integration dm channel id not found");
            return;
        }

        sendMessage(result.finalOutput as string, slackIntegration.access_token, userSlackIntegration.dm_channel_id);
        
        console.log(chalk.green("Message sent to slack"));
    }
}

export default Owner;

export type PushEvent = {
    username: string;
    installationId: number;
    repositoryName: string;
    branch: string;
    commits: Commit[];
}

export type Commit = {
    name: string;
    fileDiffs: FileDiff[];
}

export type FileDiff = {
    filename: string;
    diff: string;
}

// helper function to convert the push event to a string
export const pushEventToString = (event: PushEvent): string[] => {

    /// For every commit, we want to create a string that is a summary of the commit
    const commitStrings = event.commits.map(commit => {
        return `
        username: ${event.username}
        installationId: ${event.installationId}
        repositoryName: ${event.repositoryName}
        branch: ${event.branch}
        commit: ${commit.name}
        Changed Files: ${commit.fileDiffs.map(diff => diff.filename).join(', ')}
        `;
    });

    return commitStrings;
}

export const eventForAgent = (event: PushEvent, searchResults: SearchResult[]): string => {
    return `
    username: ${event.username}
    installationId: ${event.installationId}
    repositoryName: ${event.repositoryName}
    branch: ${event.branch}
    commits: ${event.commits.map(commit => commit.name).join(', ')}

    ${event.commits.map(commit => `
    commit: ${commit.name}
    Changed Files: ${commit.fileDiffs.map(diff => diff.filename).join(', ')}
    diffs: ${commit.fileDiffs.map(diff => diff.diff).join('\n')}
    }
    `).join('\n')}

    Possibly Related Tickets:
    `;
}

// export const eventForAgent = (event: PushEvent, searchResults: SearchResult[]): string => {
//     let eventString = pushEventToString(event);

//     eventString += `
//     Possibly Related Tickets:
//     `;

//     eventString += searchResults.map(result => `
//     ${result.content}
//     `).join('\n');

//     return eventString;
// }
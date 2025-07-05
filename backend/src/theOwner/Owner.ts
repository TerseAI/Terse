import { TicketManager } from "../ticketing/TicketIntegration";
import { Search } from "../search/search";
import { Analyzer } from "src/agent/agents/Analyzer";
import { Session } from "../server";
import chalk from "chalk";
import { SearchResult } from "src/search/SearchItem";

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

        // Run semantic search on the push event
        const searchResults = await this.searchSystem.search(pushEventToString(event), {
            teamId: event.installationId.toString(),
            entityTypes: ['ticket'],
            minSimilarity: 0.2,
            filters: [],
            limit: 10
        });

        console.log(chalk.blue('Search results'), searchResults);

        // Run the analyzer
        analyzer.analyze(eventForAgent(event, searchResults));

        // Run the analyzer
        const result = await analyzer.run();

        console.log(chalk.blue('Analyzer result'), result);
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
export const pushEventToString = (event: PushEvent) => {
    return `
    username: ${event.username}
    installationId: ${event.installationId}
    repositoryName: ${event.repositoryName}
    branch: ${event.branch}
    commits: ${event.commits.map(commit => commit.name).join(', ')}

    ${event.commits.map(commit => `
    commit: ${commit.name}
    fileDiffs: ${commit.fileDiffs.map(diff => diff.filename).join(', ')}
    `).join('\n')}

    Possibly Related Tickets:
    `;
}

export const eventForAgent = (event: PushEvent, searchResults: SearchResult[]): string => {
    let eventString = pushEventToString(event);

    eventString += `
    Possibly Related Tickets:
    `;

    eventString += searchResults.map(result => `
    ${result.content}
    `).join('\n');

    return eventString;
}
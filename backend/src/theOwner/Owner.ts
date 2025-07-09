import { Search } from '../searchClient';
import { Session } from '../server';
import { SearchResult } from '../search/SearchItem';
import { Analyzer } from '../agent/agents/Analyzer';
import chalk from 'chalk';
import { db } from '../prismaClient';
import { sendMessage } from '../slack/sendMessage';

class Owner {
    private searchSystem: Search;
    private session: Session;

    constructor(searchSystem: Search, session: Session) {
        this.searchSystem = searchSystem;
        this.session = session;
    }

    async handleUnifiedGitHubEvent(event: UnifiedGitHubEvent) {
        console.log('The owner is handling a unified GitHub event', event);
        const analyzer = new Analyzer(this.session);

        const results: SearchResult[][] = [];
        
        // Search through commit messages
        for (const commit of event.commits) {
            const searchResults = await this.searchSystem.search(commit.name, {
                teamId: this.session.teamId || '',
                entityTypes: ['ticket'],
                minSimilarity: 0.4,
                filters: [],
                limit: 10
            });

            console.log(chalk.blue('Search results for commit name', commit.name), searchResults);
            results.push(searchResults);
        }

        // Search through PR title and body if available
        if (event.pullRequest) {
            const prContent = `${event.pullRequest.title} ${event.pullRequest.body || ''}`;
            const prSearchResults = await this.searchSystem.search(prContent, {
                teamId: this.session.teamId || '',
                entityTypes: ['ticket'],
                minSimilarity: 0.4,
                filters: [],
                limit: 10
            });

            console.log(chalk.blue('Search results for PR content'), prSearchResults);
            results.push(prSearchResults);
        }

        // flatten the results
        const flattenedResults = results.flat();
        // de-duplicate the results
        const uniqueResults = flattenedResults.filter((result, index, self) =>
            index === self.findIndex((t) => t.entityId === result.entityId && t.entityType === result.entityType)
        );

        const unifiedEvent = unifiedGitHubEventForAgent(event, uniqueResults);
        console.log(chalk.blue('Unified event for model'), unifiedEvent);

        // Run the analyzer with comprehensive context
        analyzer.analyze(unifiedEvent);

        // Run the analyzer
        const result = await analyzer.run();

        console.log(chalk.blue('Analyzer result for unified event'), result.finalOutput);

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

export type Commit = {
    name: string;
    fileDiffs: FileDiff[];
}

export type FileDiff = {
    filename: string;
    diff: string;
}

type UnifiedGitHubEvent = {
    username: string;
    installationId: number;
    repositoryName: string;
    eventType: 'push' | 'pull_request.opened' | 'pull_request.synchronize' | 'pull_request.closed' | 'pull_request.merged';
    branch?: string;
    commits: Commit[];
    pullRequest?: {
        id: string;
        number: number;
        title: string;
        body?: string;
        state: 'open' | 'closed';
        merged: boolean;
        head: {
            ref: string;
            sha: string;
        };
        base: {
            ref: string;
            sha: string;
        };
        user: {
            login: string;
            email?: string;
        };
    };
    repository: {
        name: string;
        owner: string;
        defaultBranch: string;
    };
    sender: {
        login: string;
        email?: string;
    };
}

export const unifiedGitHubEventForAgent = (event: UnifiedGitHubEvent, searchResults: SearchResult[]): string => {
    let eventString = `
    Unified GitHub Event:
    username: ${event.username}
    installationId: ${event.installationId}
    repositoryName: ${event.repositoryName}
    eventType: ${event.eventType}
    `;

    if (event.branch) {
        eventString += `branch: ${event.branch}\n`;
    }

    if (event.pullRequest) {
        eventString += `
    pullRequest:
      id: ${event.pullRequest.id}
      number: ${event.pullRequest.number}
      title: ${event.pullRequest.title}
      body: ${event.pullRequest.body || 'No description'}
      state: ${event.pullRequest.state}
      merged: ${event.pullRequest.merged}
      head: ${event.pullRequest.head.ref} (${event.pullRequest.head.sha})
      base: ${event.pullRequest.base.ref} (${event.pullRequest.base.sha})
      user: ${event.pullRequest.user.login}
    `;
    }

    eventString += `
    commits: ${event.commits.map(commit => commit.name).join(', ')}

    ${event.commits.map(commit => `
    commit: ${commit.name}
    Changed Files: ${commit.fileDiffs.map(diff => diff.filename).join(', ')}
    diffs: ${commit.fileDiffs.map(diff => diff.diff).join('\n')}
    }
    `).join('\n')}

    Possibly Related Tickets:
    ${searchResults.map(result => `- ${result.entityId} (${result.entityType}): ${result.content}`).join('\n')}

    IMPORTANT: For unified events:
    - If eventType is 'push': Look for related tickets and mark them as "In Progress"
    - If eventType is 'pull_request.opened': Look for related tickets and mark them as "In Progress" or "In Review"
    - If eventType is 'pull_request.synchronize': Update progress on related tickets
    - If eventType is 'pull_request.merged': Mark related tickets as "Done" if the feature/bug fix appears complete
    - If eventType is 'pull_request.closed' (but not merged): Consider if tickets should be marked as "Cancelled" or left as-is
    `;
    return eventString;
}
import { Search } from '../searchClient';
import { Session } from '../server';
import { SearchResult } from '../search/SearchItem';
import { Analyzer } from '../agent/agents/Analyzer';
import chalk from 'chalk';
import { db } from '../prismaClient';
import { sendMessage } from '../slack/sendMessage';
import { ChangedItem } from '../shared/ModelEvents';
import { Commit, UnifiedGitHubEvent, unifiedGitHubEventForAgent } from './utility';
import { TicketManager } from 'src/ticketing/TicketIntegration';

class Owner {
    private searchSystem: Search;
    private session: Session;

    constructor(searchSystem: Search, session: Session) {
        this.searchSystem = searchSystem;
        this.session = session;
    }

    async handleUnifiedGitHubEvent(event: UnifiedGitHubEvent): Promise<ChangedItem[]> {
        console.log('The owner is handling a unified GitHub event', event.eventType, event.repositoryName, event.username);
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

        // filter out completed tickets
        const filteredResults = uniqueResults.filter(async (result) => {
            const isComplete = await this.session.ticketManager?.isTicketComplete(result.entityId);
            return !isComplete;
        });

        const unifiedEvent = unifiedGitHubEventForAgent(event, filteredResults);

        // Set commit context in the analyzer
        analyzer.setCommitContext(event.commits, event.repository, event.branch);

        // Run the analyzer with comprehensive context
        analyzer.analyze(unifiedEvent);

        // Run the analyzer
        const result = await analyzer.run();

        console.log(chalk.blue('Analyzer result for unified event'), result.finalOutput);

        const changedItems = analyzer.getAndClearChangedItems();
        console.log(chalk.blue('Changed items'), changedItems);

        // Save activity, send slack message
        await this.sendSlackMessage(result.finalOutput as string);

        return changedItems;
    }

    async sendSlackMessage(message: string) {
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

        sendMessage(message, slackIntegration.access_token, userSlackIntegration.dm_channel_id);

        console.log(chalk.green("Message sent to slack"));
    }
}

export default Owner;
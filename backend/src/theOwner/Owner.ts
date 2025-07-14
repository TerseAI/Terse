import { Search } from '../searchClient';
import { Session } from '../server';
import { SearchResult } from '../search/SearchItem';
import { Analyzer } from '../agent/agents/Analyzer';
import chalk from 'chalk';
import { db } from '../prismaClient';
import { sendMessage } from '../slack/sendMessage';
import { ChangedItem } from '../shared/ModelEvents';
import { UnifiedGitHubEvent, unifiedGitHubEventForAgent } from './utility';

class Owner {
    private searchSystem: Search;
    private session: Session;

    constructor(searchSystem: Search, session: Session) {
        this.searchSystem = searchSystem;
        this.session = session;
    }

    async handleUnifiedGitHubEvent(event: UnifiedGitHubEvent): Promise<ChangedItem[]> {
        const eventId = `${event.username}-${event.repositoryName}-${event.eventType}-${Date.now()}`;
        console.log(chalk.blue(`[${eventId}] The owner is handling a unified GitHub event`), event.eventType, event.repositoryName, event.username);
        console.log(chalk.blue(`[${eventId}] Session user:`, this.session.user.github_username, 'Team ID:', this.session.teamId));
        
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

            console.log(chalk.blue(`[${eventId}] Search results for commit name`, commit.name), searchResults);
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

            console.log(chalk.blue(`[${eventId}] Search results for PR content`), prSearchResults);
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
        console.log(chalk.blue(`[${eventId}] Filtered results going into the analyzer`), filteredResults.length);
        const unifiedEvent = unifiedGitHubEventForAgent(event, filteredResults);

        console.log(chalk.blue(`[${eventId}] Commits Shas`), event.commits.map(c => c.sha));

        // Set commit context in the analyzer
        analyzer.setCommitContext(event.commits, event.repository, event.branch);

        // Run the analyzer with comprehensive context
        analyzer.analyze(unifiedEvent);

        // Run the analyzer
        const result = await analyzer.run();

        console.log(chalk.blue(`[${eventId}] Analyzer result for unified event`), result.finalOutput);

        const changedItems = analyzer.getAndClearChangedItems();
        console.log(chalk.blue(`[${eventId}] Changed items`), changedItems);

        // Save activity, send slack message
        await this.sendSlackMessage(result.finalOutput as string, eventId);

        console.log(chalk.green(`[${eventId}] Event processing completed successfully`));
        return changedItems;
    }

    async sendSlackMessage(message: string, eventId: string) {
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

        console.log(chalk.green(`[${eventId}] Message sent to slack`));
    }
}

export default Owner;
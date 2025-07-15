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

    async handleUnifiedGitHubEvent(event: UnifiedGitHubEvent): Promise<string> {
        const eventId = `${event.username}-${event.repositoryName}-${event.eventType}-${Date.now()}`;
        console.log(chalk.blue(`[${eventId}] The owner is handling a unified GitHub event`), event.eventType, event.repositoryName, event.username);
        console.log(chalk.blue(`[${eventId}] Session user:`, this.session.user.github_username, 'Team ID:', this.session.teamId));
        
        const analyzer = new Analyzer(this.session);

        console.log(chalk.blue(`[${eventId}] Commits Shas`), event.commits.map(c => c.sha));

        // Set commit context in the analyzer
        analyzer.setCommitContext(event.commits, event.repository, event.branch);

        for (const commit of event.commits) {
            await analyzer.analyze(commit.name);
            const runResult = await analyzer.run();
            analyzer.history = runResult.history
        }

        // send final indicator.
        await analyzer.analyze('No more commits to show. Generate a summary of the changes via the Tool CreateActionSummry.');
        const runResult = await analyzer.executeFinalSummary();
        analyzer.history = runResult.history

        const finalSummary = analyzer.getAndClearFinalSummary();
        console.log(chalk.blue(`[${eventId}] Final summary`), finalSummary);
        console.log(chalk.green(`[${eventId}] Event processing completed successfully`));
        return finalSummary || '';
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
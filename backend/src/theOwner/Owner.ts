import { Search } from '../searchClient';
import { Session } from '../server';
import { ActivityOverview, Analyzer } from '../agent/agents/Analyzer';
import chalk from 'chalk';
import { db } from '../prismaClient';
import { sendMessage } from '../slack/sendMessage';
import { Commit, UnifiedGitHubEvent } from './utility';
import { enrich, EnrichmentResult } from './Enrich';

class Owner {
    private searchSystem: Search;
    private session: Session;

    constructor(searchSystem: Search, session: Session) {
        this.searchSystem = searchSystem;
        this.session = session;
    }

    async handleUnifiedGitHubEvent(event: UnifiedGitHubEvent): Promise<ActivityOverview | null> {
        const eventId = `${event.username}-${event.repositoryName}-${event.eventType}-${event.branch}-${Date.now()}`;
        console.log(chalk.blue(`[${eventId}] The owner is handling a unified GitHub event`), event.eventType, event.repositoryName, event.username);
        console.log(chalk.blue(`[${eventId}] Session user:`, this.session.user.github_username, 'Team ID:', this.session.teamId));
        
        const analyzer = new Analyzer(this.session);

        console.log(chalk.blue(`[${eventId}] Commits Shas`), event.commits.map(c => c.sha));

        // Get the branch and attempt to enrich it
        let enrichmentResult: EnrichmentResult | null = null;
        if (event.branch && event.commits.length > 0) {
            enrichmentResult = await enrich(event.branch, event.commits[0].name, this.session);
        }

        if (!enrichmentResult) {
            console.error(chalk.red.bold("✗ No enrichment result found. Unable to enrich activity event."));
            return null;
        }

        // Set commit context in the analyzer
        analyzer.setCommitContext({
            commits: event.commits,
            repository: event.repository,
            branch: event.branch,
            ticket: enrichmentResult.ticket,
            project: enrichmentResult.project || undefined
        });

        for (const commit of event.commits) {
            await analyzer.analyze(this.generateCommitString(commit));
            const runResult = await analyzer.run();
            analyzer.history = runResult.history
        }

        // send final indicator.
        await analyzer.analyze('No more commits to show. Generate a summary of the changes via the Tool CreateActionSummry.');
        const runResult = await analyzer.executeFinalSummary();
        analyzer.history = runResult.history

        let finalSummary = analyzer.getAndClearFinalSummary();

        console.log(chalk.blue(`[${eventId}] Final summary`), finalSummary);
        console.log(chalk.green(`[${eventId}] Event processing completed successfully`));

        return finalSummary;
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

    // Generates a string representation of a commit for LLM ingestion.
    // Includes patch diffs only if their total length is less than 1000 characters.
    generateCommitString(commit: Commit): string {
        let result = `Commit: ${commit.sha}\n`;
        result += `Message: ${commit.name}\n`;

        if (commit.fileDiffs && Array.isArray(commit.fileDiffs)) {
            // Calculate total patch length
            let totalPatchLength = 0;
            for (const file of commit.fileDiffs) {
                if (file.diff) {
                    totalPatchLength += file.diff.length;
                }
            }

            if (totalPatchLength < 1000) {
                result += `Files changed (${commit.fileDiffs.length}):\n`;
                for (const file of commit.fileDiffs) {
                    result += `- ${file.filename}\n`;
                    if (file.diff) {
                        result += `Patch:\n${file.diff}\n`;
                    }
                }
            } else {
                result += `Files changed (${commit.fileDiffs.length}):\n`;
                for (const file of commit.fileDiffs) {
                    result += `- ${file.filename}\n`;
                }
                result += `\n(Patch diffs omitted due to size)\n`;
            }
        }

        return result.trim();
    }
}

export default Owner;
import { Search } from '../searchClient';
import { Session } from '../server';
import { ActivityOverview, Analyzer } from '../agent/agents/Analyzer';
import chalk from 'chalk';
import { Commit, GithubAppUnifiedEventRequest } from '../routes/GithubTypes';
import { enrich, EnrichmentResult } from './Enrich';
import logger from '../logger';

class Owner {
    private searchSystem: Search;
    private session: Session;

    constructor(searchSystem: Search, session: Session) {
        this.searchSystem = searchSystem;
        this.session = session;
    }

    async handleUnifiedGitHubEvent(event: GithubAppUnifiedEventRequest): Promise<ActivityOverview | null> {
        const eventId = `${event.username}-${event.repositoryName}-${event.eventType}-${event.branch}-${Date.now()}`;
        logger.info(`[${eventId}] The owner is handling a unified GitHub event`, { eventType: event.eventType, repositoryName: event.repositoryName, username: event.username, eventId });
        logger.debug(`[${eventId}] Session user`, { githubUsername: this.session.user.github_username, teamId: this.session.teamId, userId: this.session.user.id, eventId });
        
        const analyzer = new Analyzer(this.session);

        logger.debug(`[${eventId}] Commits Shas`, { commitShas: event.commits.map(c => c.sha), commitCount: event.commits.length, eventId });

        // Get the branch and attempt to enrich it
        let enrichmentResult: EnrichmentResult | null = null;
        if (event.branch && event.commits.length > 0) {
            enrichmentResult = await enrich(event.branch, event.commits[0].name, this.session);
        }

        if (!enrichmentResult) {
            logger.warn("✗ No enrichment result found. Unable to enrich activity event.", { eventId, branch: event.branch, commitCount: event.commits.length });
        }

        // Set commit context in the analyzer
        analyzer.setCommitContext({
            commits: event.commits,
            repository: event.repository,
            branch: event.branch,
            ticket: enrichmentResult?.ticket,
            project: enrichmentResult?.project || undefined
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

        logger.info(`[${eventId}] Final summary`, { eventId, hasSummary: !!finalSummary, summarySubActivities: finalSummary?.sub_activity_overviews?.length || 0 });
        logger.info(`[${eventId}] Event processing completed successfully`, { eventId, repositoryName: event.repositoryName, eventType: event.eventType });

        return finalSummary;
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
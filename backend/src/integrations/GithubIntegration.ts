import { Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import chalk from "chalk";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";
import { InputEvent } from "./abstract/InputEvent";
import { GithubIntegration } from "../shared/types";
import { GithubAppUnifiedEventRequest } from "../routes/github";
import { resolveUserForGithubInstallation } from "../routes/github";
import { User } from "../types/prisma";
import { IntegrationType } from "@prisma/client";
import { AutomationInputWithConfigs } from "../types/prisma";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";

export class GithubIntegrationManager implements Integration<GithubIntegration, GithubAppUnifiedEventRequest> {
    constructor() { }

    async getInstancesForUser(userId: string): Promise<GithubIntegration[]> {
        const userGithubRepos = await db().user_github_repositories.findMany({
            where: { user_id: userId },
            include: { github_repository: true }
        });
        return userGithubRepos.map(ugr => ({
            id: ugr.github_repository.id,
            repositoryName: ugr.github_repository.name,
            owner: ugr.github_repository.owner
        }));
    }

    async processWebhookEvent(event: GithubAppUnifiedEventRequest): Promise<void> {
        const user: User | null = await resolveUserForGithubInstallation(event.installationId, event.username);

        if (!user) {
            console.log(chalk.yellow(`⚠️  No user found for GitHub event from ${event.username}`));
            return;
        }

        const githubEvent = new GithubEvent(event);
        const eventProcessor = new EventProcessor(githubEvent, user);
        await eventProcessor.process();
    }
}

// MARK: - GithubEvent

export class GithubEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.GITHUB;
    data: GithubAppUnifiedEventRequest;
    
    constructor(data: GithubAppUnifiedEventRequest) {
        super();
        this.data = data;
    }

    formatForAutomationAgent(): string {
        const indentMultiline = (text: string): string =>
            text
                .split('\n')
                .map((line) => `        ${line}`)
                .join('\n');

        // Event type description
        const eventTypeDescriptions: Record<string, string> = {
            'push': 'Code Push Event',
            'pull_request.opened': 'Pull Request Opened',
            'pull_request.synchronize': 'Pull Request Updated (new commits added)',
            'pull_request.closed': 'Pull Request Closed',
            'pull_request.merged': 'Pull Request Merged'
        };
        const eventDescription = eventTypeDescriptions[this.data.eventType] || this.data.eventType;

        // Repository information
        const repoInfo = [
            `Repository: ${this.data.repository.owner}/${this.data.repository.name}`,
            `Repository ID: ${this.data.repository.id}`,
            `Default Branch: ${this.data.repository.defaultBranch}`,
            `View on GitHub: https://github.com/${this.data.repository.owner}/${this.data.repository.name}`
        ].join('\n');

        // Sender/Actor information
        const senderInfo = [
            `Actor: ${this.data.sender.login}`,
            ...(this.data.sender.email ? [`Email: ${this.data.sender.email}`] : [])
        ].join('\n');

        // Branch information (for push events)
        const branchInfo = this.data.branch 
            ? `Branch: ${this.data.branch}`
            : null;

        // Pull Request information (for PR events)
        let prInfo = '';
        if (this.data.pullRequest) {
            const pr = this.data.pullRequest;
            const prLines = [
                `Pull Request #${pr.number}: ${pr.title}`,
                `State: ${pr.state}${pr.merged ? ' (merged)' : ''}`,
                `Author: ${pr.user.login}${pr.user.email ? ` (${pr.user.email})` : ''}`,
                `Head Branch: ${pr.head.ref} (${pr.head.sha.substring(0, 7)})`,
                `Base Branch: ${pr.base.ref} (${pr.base.sha.substring(0, 7)})`,
                `View PR: https://github.com/${this.data.repository.owner}/${this.data.repository.name}/pull/${pr.number}`
            ];
            if (pr.body) {
                prLines.push(`\nDescription:\n${indentMultiline(pr.body)}`);
            }
            prInfo = prLines.join('\n');
        }

        // Commits information
        let commitsInfo = '';
        if (this.data.commits && this.data.commits.length > 0) {
            const commitLines: string[] = [];
            commitLines.push(`Commits (${this.data.commits.length}):`);
            
            this.data.commits.forEach((commit, index) => {
                const shortSha = commit.sha.substring(0, 7);
                const commitUrl = `https://github.com/${this.data.repository.owner}/${this.data.repository.name}/commit/${commit.sha}`;
                
                commitLines.push(`\n${index + 1}. Commit ${shortSha}: ${commit.name}`);
                commitLines.push(`   URL: ${commitUrl}`);
                
                if (commit.fileDiffs && commit.fileDiffs.length > 0) {
                    commitLines.push(`   Files Changed: ${commit.fileDiffs.length}`);
                    
                    // List files changed
                    const fileList = commit.fileDiffs.map(f => `     - ${f.filename}`).join('\n');
                    commitLines.push(`   Files:\n${fileList}`);
                    
                    // Show diffs for important files (limit to first 3 files to avoid overwhelming)
                    const filesToShow = commit.fileDiffs.slice(0, 3);
                    filesToShow.forEach(file => {
                        if (file.diff) {
                            // Truncate very long diffs
                            const maxDiffLines = 50;
                            const diffLines = file.diff.split('\n');
                            const truncatedDiff = diffLines.length > maxDiffLines
                                ? diffLines.slice(0, maxDiffLines).join('\n') + `\n     ... (${diffLines.length - maxDiffLines} more lines)`
                                : file.diff;
                            
                            commitLines.push(`\n   Diff for ${file.filename}:`);
                            commitLines.push(indentMultiline(truncatedDiff));
                        }
                    });
                    
                    if (commit.fileDiffs.length > 3) {
                        commitLines.push(`\n   ... and ${commit.fileDiffs.length - 3} more file(s) changed`);
                    }
                }
            });
            
            commitsInfo = commitLines.join('\n');
        }

        // Build the formatted output
        const sections = [
            `Incoming GitHub Event: ${eventDescription}`,
            `\nRepository Information:\n${indentMultiline(repoInfo)}`,
            `\nActor Information:\n${indentMultiline(senderInfo)}`,
            ...(branchInfo ? [`\nBranch Information:\n${indentMultiline(branchInfo)}`] : []),
            ...(prInfo ? [`\nPull Request Information:\n${indentMultiline(prInfo)}`] : []),
            ...(commitsInfo ? [`\n${commitsInfo}`] : [])
        ].filter(Boolean);

        return sections.join('\n\n') + '\n';
    }

    debugLog(): string {
        return `GitHub Event: ${this.data.eventType} - ${this.data.repositoryName} - ${this.data.username}`;
    }

    matchesAutomationInput(automationInput: AutomationInputWithConfigs): boolean {
        console.log(chalk.blue('GithubEvent matchesAutomationInput'), automationInput.integration_type, this.data.repository.id);
        if (automationInput.integration_type !== IntegrationType.GITHUB) {
            return false;
        }
        const githubConfig = automationInput.github_config;

        // Make sure the repository is in the list of repositories configured for the automation
        if (!githubConfig?.repository_ids.includes(this.data.repository.id)) {
            console.log(chalk.red('GithubEvent matchesAutomationInput'), 'repository not found in automation', this.data.repository.id, githubConfig?.repository_ids);
            return false;
        }

        return true
    }
    
    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: 'github_event',
            integration: 'github',
            source: this.data.repositoryName,
            title: this.data.eventType,
            subheader: this.data.username,
            url: `https://github.com/${this.data.repositoryName}/`,
        };
    }

    getImageUrls(): string[] {
        return [];
    }
}

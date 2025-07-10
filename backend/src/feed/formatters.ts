import { UnifiedGitHubEvent } from "../theOwner/utility";

export function formatTitleForEvent(event: UnifiedGitHubEvent): string {
    if (event.eventType === 'push') {
        return formatTitleForPushEvent(event);
    } else if (event.eventType === 'pull_request.opened') {
        return formatTitleForPullRequestEvent(event);
    } else if (event.eventType === 'pull_request.synchronize') {
        return formatTitleForPullRequestUpdateEvent(event);
    } else if (event.eventType === 'pull_request.merged') {
        return formatTitleForPullRequestMergeEvent(event);
    } else if (event.eventType === 'pull_request.closed') {
        return formatTitleForPullRequestCloseEvent(event);
    }
    return `Event in ${event.repository.name} by ${event.username}`;
}

function formatTitleForPushEvent(event: UnifiedGitHubEvent): string {
    const commitCount = event.commits.length;
    const commitNames = event.commits.map(commit => commit.name).join(', ');
    const allFiles = event.commits.flatMap(commit => commit.fileDiffs.map(diff => diff.filename));
    const uniqueFiles = [...new Set(allFiles)];
    const fileCount = uniqueFiles.length;
    const fileNames = uniqueFiles.slice(0, 3).join(', ');
    const moreFiles = fileCount > 3 ? ` and ${fileCount - 3} more` : '';
    
    return `Push to ${event.repository.name} by ${event.username} (${commitCount} commit${commitCount > 1 ? 's' : ''}: ${commitNames}) - ${fileCount} file${fileCount > 1 ? 's' : ''} changed: ${fileNames}${moreFiles}`;
}

function formatTitleForPullRequestEvent(event: UnifiedGitHubEvent): string {
    const commitCount = event.commits.length;
    const commitNames = event.commits.map(commit => commit.name).join(', ');
    const allFiles = event.commits.flatMap(commit => commit.fileDiffs.map(diff => diff.filename));
    const uniqueFiles = [...new Set(allFiles)];
    const fileCount = uniqueFiles.length;
    const fileNames = uniqueFiles.slice(0, 3).join(', ');
    const moreFiles = fileCount > 3 ? ` and ${fileCount - 3} more` : '';
    
    return `Pull request ${event.pullRequest?.number} opened in ${event.repository.name} by ${event.username} (${commitCount} commit${commitCount > 1 ? 's' : ''}: ${commitNames}) - ${fileCount} file${fileCount > 1 ? 's' : ''} changed: ${fileNames}${moreFiles}`;
}

function formatTitleForPullRequestUpdateEvent(event: UnifiedGitHubEvent): string {
    const commitCount = event.commits.length;
    const commitNames = event.commits.map(commit => commit.name).join(', ');
    const allFiles = event.commits.flatMap(commit => commit.fileDiffs.map(diff => diff.filename));
    const uniqueFiles = [...new Set(allFiles)];
    const fileCount = uniqueFiles.length;
    const fileNames = uniqueFiles.slice(0, 3).join(', ');
    const moreFiles = fileCount > 3 ? ` and ${fileCount - 3} more` : '';
    
    return `Pull request ${event.pullRequest?.number} updated in ${event.repository.name} by ${event.username} (${commitCount} commit${commitCount > 1 ? 's' : ''}: ${commitNames}) - ${fileCount} file${fileCount > 1 ? 's' : ''} changed: ${fileNames}${moreFiles}`;
}

function formatTitleForPullRequestMergeEvent(event: UnifiedGitHubEvent): string {
    const commitCount = event.commits.length;
    const commitNames = event.commits.map(commit => commit.name).join(', ');
    const allFiles = event.commits.flatMap(commit => commit.fileDiffs.map(diff => diff.filename));
    const uniqueFiles = [...new Set(allFiles)];
    const fileCount = uniqueFiles.length;
    const fileNames = uniqueFiles.slice(0, 3).join(', ');
    const moreFiles = fileCount > 3 ? ` and ${fileCount - 3} more` : '';
    
    return `Pull request ${event.pullRequest?.number} merged in ${event.repository.name} by ${event.username} (${commitCount} commit${commitCount > 1 ? 's' : ''}: ${commitNames}) - ${fileCount} file${fileCount > 1 ? 's' : ''} changed: ${fileNames}${moreFiles}`;
}

function formatTitleForPullRequestCloseEvent(event: UnifiedGitHubEvent): string {
    const commitCount = event.commits.length;
    const commitNames = event.commits.map(commit => commit.name).join(', ');
    const allFiles = event.commits.flatMap(commit => commit.fileDiffs.map(diff => diff.filename));
    const uniqueFiles = [...new Set(allFiles)];
    const fileCount = uniqueFiles.length;
    const fileNames = uniqueFiles.slice(0, 3).join(', ');
    const moreFiles = fileCount > 3 ? ` and ${fileCount - 3} more` : '';
    
    return `Pull request ${event.pullRequest?.number} closed in ${event.repository.name} by ${event.username} (${commitCount} commit${commitCount > 1 ? 's' : ''}: ${commitNames}) - ${fileCount} file${fileCount > 1 ? 's' : ''} changed: ${fileNames}${moreFiles}`;
}
import { SearchResult } from "../search/SearchItem";

export type Commit = {
    sha: string;
    name: string;
    fileDiffs: FileDiff[];
}

export type FileDiff = {
    filename: string;
    diff: string;
}

export type UnifiedGitHubEvent = {
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

// diffs: ${commit.fileDiffs.map(diff => diff.diff).join('\n')}
export type GitHubUserPayload = {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    user_view_type: string;
    site_admin: boolean;
    name: string | null;
    company: string | null;
    blog: string;
    location: string | null;
    email: string | null;
    hireable: boolean | null;
    bio: string | null;
    twitter_username: string | null;
    notification_email: string | null;
    public_repos: number;
    public_gists: number;
    followers: number;
    following: number;
    created_at: string;
    updated_at: string;
    private_gists: number;
    total_private_repos: number;
    owned_private_repos: number;
    disk_usage: number;
    collaborators: number;
    two_factor_authentication: boolean;
    plan: {
        name: string;
        space: number;
        collaborators: number;
        private_repos: number;
    };
};

/**
 * GitHub unified event request type
 * Used for processing GitHub webhook events (push, PR, etc.)
 */
export type GithubAppUnifiedEventRequest = {
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
    // Additional context
    repository: {
        id: number;
        name: string;
        owner: string;
        defaultBranch: string;
    };
    sender: {
        login: string;
        email?: string;
    };
};

export type GithubAppInstallationDeletedRequest = {
    username: string;
    installationId: number;
}

export type Commit = {
    sha: string;
    name: string;
    fileDiffs: FileDiff[];
}

export type FileDiff = {
    filename: string;
    diff: string;
}

export type GithubAppUser = {
    login: string;
    id: number;
    name: string;
    avatar_url: string;
    email: string | null;
}

export type GithubUserRepository = {
    id: number;
    name: string;
    owner: string;
}
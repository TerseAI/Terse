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
    timestamp?: Date;
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

export type GithubAppInstallationResponse = {
    total_count: number;
    installations: GithubAppInstallation[];
}

export type GithubAppInstallation = {
    id: number;
    client_id: string;
    account: {
        login: string;
        id: number;
        node_id: string;
        avatar_url: string;
        type: string;
        site_admin: boolean;
    };
    repository_selection: 'all' | 'selected';
    access_tokens_url: string;
    repositories_url: string;
    html_url: string;
    app_id: number;
    app_slug: string;
    target_id: number;
    target_type: 'Organization' | 'User';
    permissions: Record<string, string>;
    events: string[];
    created_at: string;
    updated_at: string;
    single_file_name: string | null;
    has_multiple_single_files: boolean;
    single_file_paths: string[];
    suspended_by: unknown | null;
    suspended_at: string | null;
}

export type GithubAppInstallationRepositoryResponse = {
    total_count: number;
    repositories: GithubAppInstallationRepository[];
}
export type GithubAppInstallationRepository = {
    id: number;
    node_id: string;
    name: string;
    full_name: string;
    private: boolean;
    owner: {
        login: string;
        id: number;
        node_id: string;
        avatar_url: string;
        type: string;
        site_admin: boolean;
    };
    html_url: string;
    description: string | null;
    fork: boolean;
    url: string;
    forks_url: string;
    keys_url: string;
    collaborators_url: string;
    teams_url: string;
    hooks_url: string;
    issue_events_url: string;
    events_url: string;
    assignees_url: string;
    branches_url: string;
    tags_url: string;
    blobs_url: string;
    git_tags_url: string;
    git_refs_url: string;
    trees_url: string;
    statuses_url: string;
    languages_url: string;
    stargazers_url: string;
    contributors_url: string;
    subscribers_url: string;
    subscription_url: string;
    commits_url: string;
    git_commits_url: string;
    comments_url: string;
    issue_comment_url: string;
    contents_url: string;
    compare_url: string;
    merges_url: string;
    archive_url: string;
    downloads_url: string;
    issues_url: string;
    pulls_url: string;
    milestones_url: string;
    notifications_url: string;
    labels_url: string;
    releases_url: string;
    deployments_url: string;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    git_url: string;
    ssh_url: string;
    clone_url: string;
    svn_url: string;
    homepage: string | null;
    size: number;
    stargazers_count: number;
    watchers_count: number;
    language: string | null;
    has_issues: boolean;
    has_projects: boolean;
    has_downloads: boolean;
    has_wiki: boolean;
    has_pages: boolean;
    has_discussions: boolean;
    forks_count: number;
    mirror_url: string | null;
    archived: boolean;
    disabled: boolean;
    open_issues_count: number;
    license: {
        key: string;
        name: string;
        spdx_id: string;
        url: string;
        node_id: string;
    } | null;
    allow_forking: boolean;
    is_template: boolean;
    web_commit_signoff_required: boolean;
    topics: string[];
    visibility: 'public' | 'private' | 'internal';
    forks: number;
    open_issues: number;
    watchers: number;
    default_branch: string;
    permissions: {
        admin: boolean;
        maintain: boolean;
        push: boolean;
        triage: boolean;
        pull: boolean;
    };
}
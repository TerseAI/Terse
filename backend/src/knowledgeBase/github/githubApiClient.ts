import { Octokit } from '@octokit/rest';
import { DateTime } from 'luxon';
import logger from '../../logger';
import { db } from '../../prismaClient';

/**
 * Configuration for GitHub KB session
 */
export interface GitHubKBSessionConfig {
    accessToken: string;
    repositories: {
        id: number;
        fullName: string; // owner/repo format
        defaultBranch: string;
    }[];
}

/**
 * Creates an authenticated Octokit client
 */
export function createGitHubClient(accessToken: string): Octokit {
    return new Octokit({
        auth: accessToken,
    });
}

/**
 * Get the user's GitHub OAuth access token
 */
export async function getGitHubAccessToken(userId: string): Promise<string | null> {
    const githubToken = await db().github_app_tokens.findFirst({
        where: { user_id: userId },
    });

    if (!githubToken) {
        logger.warn('No GitHub OAuth token found for user', { userId });
        return null;
    }

    return githubToken.access_token;
}

/**
 * Get GitHub access token by integration ID
 * Validates that the integration belongs to the user
 */
export async function getGitHubAccessTokenByIntegrationId(integrationId: string, userId: string): Promise<string | null> {
    const githubToken = await db().github_app_tokens.findUnique({
        where: { id: integrationId },
    });

    if (!githubToken) {
        logger.warn('GitHub integration not found', { integrationId, userId });
        return null;
    }

    if (githubToken.user_id !== userId) {
        logger.warn('GitHub integration does not belong to user', { integrationId, userId, tokenUserId: githubToken.user_id });
        return null;
    }

    return githubToken.access_token;
}

/**
 * Get repository information including the default branch
 */
export async function getRepositoryInfo(
    client: Octokit,
    owner: string,
    repo: string
): Promise<{ id: number; fullName: string; defaultBranch: string } | null> {
    try {
        const { data } = await client.repos.get({ owner, repo });
        return {
            id: data.id,
            fullName: data.full_name,
            defaultBranch: data.default_branch,
        };
    } catch (error: any) {
        logger.error('Failed to get repository info', { owner, repo, error: error.message });
        return null;
    }
}

/**
 * Search code in GitHub repositories
 */
export interface CodeSearchResult {
    name: string;
    path: string;
    sha: string;
    url: string;
    htmlUrl: string;
    repository: {
        id: number;
        fullName: string;
    };
    textMatches?: {
        fragment: string;
        matches: { text: string; indices: number[] }[];
    }[];
}

export async function searchCode(
    client: Octokit,
    query: string,
    repositories: string[], // owner/repo format
    options: {
        perPage?: number;
        page?: number;
    } = {}
): Promise<{ items: CodeSearchResult[]; totalCount: number; pagination: { page: number; perPage: number; hasMore: boolean } }> {
    const { perPage = 30, page = 1 } = options;
    
    // Build the repo filter
    const repoFilter = repositories.map(repo => `repo:${repo}`).join(' ');
    const fullQuery = `${query} ${repoFilter}`;
    
    try {
        const { data, headers } = await client.search.code({
            q: fullQuery,
            per_page: perPage,
            page,
            headers: {
                // Request text-match metadata for highlighted snippets
                accept: 'application/vnd.github.text-match+json',
            },
        });

        // Check if there are more pages by examining the Link header
        let hasMore = false;
        const linkHeader = headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
            hasMore = true;
        } else if (data.items.length === perPage) {
            // If we got exactly perPage results, there might be more
            // But without a Link header, we can't be certain, so we'll be conservative
            // and assume there might be more if we got a full page
            hasMore = true;
        }

        return {
            totalCount: data.total_count,
            items: data.items.map((item: any) => ({
                name: item.name,
                path: item.path,
                sha: item.sha,
                url: item.url,
                htmlUrl: item.html_url,
                repository: {
                    id: item.repository.id,
                    fullName: item.repository.full_name,
                },
                textMatches: item.text_matches?.map((match: any) => ({
                    fragment: match.fragment,
                    matches: match.matches,
                })),
            })),
            pagination: {
                page,
                perPage,
                hasMore,
            },
        };
    } catch (error: any) {
        if (error.status === 422) {
            logger.warn('GitHub code search validation error', { query: fullQuery, error: error.message });
            throw new Error('Search query is too complex or invalid. Try simplifying your search.');
        }
        if (error.status === 403) {
            logger.warn('GitHub API rate limit or access denied', { error: error.message });
            throw new Error('GitHub API rate limit exceeded or access denied.');
        }
        logger.error('GitHub code search failed', { query: fullQuery, error: error.message });
        throw error;
    }
}

/**
 * Get file contents from a GitHub repository
 */
export interface FileContent {
    name: string;
    path: string;
    sha: string;
    size: number;
    content: string; // Decoded content
    encoding: string;
    htmlUrl: string;
}

export async function getFileContents(
    client: Octokit,
    owner: string,
    repo: string,
    path: string,
    ref?: string // branch, tag, or commit SHA
): Promise<FileContent> {
    try {
        const { data } = await client.repos.getContent({
            owner,
            repo,
            path,
            ref,
        });

        // Handle files (not directories)
        if (Array.isArray(data)) {
            throw new Error(`Path "${path}" is a directory, not a file. Use listDirectory to explore directories.`);
        }

        if (data.type !== 'file') {
            throw new Error(`Path "${path}" is a ${data.type}, not a file. Use listDirectory to explore directories.`);
        }

        // Decode base64 content
        let content = '';
        if ('content' in data && data.content && data.encoding === 'base64') {
            content = Buffer.from(data.content, 'base64').toString('utf-8');
        }

        return {
            name: data.name,
            path: data.path,
            sha: data.sha,
            size: data.size,
            content,
            encoding: data.encoding || 'base64',
            htmlUrl: data.html_url || '',
        };
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`File not found: ${path}`);
        }
        logger.error('Failed to get file contents', { owner, repo, path, error: error.message });
        throw error;
    }
}

/**
 * List directory contents in a GitHub repository
 */
export interface DirectoryEntry {
    name: string;
    path: string;
    sha: string;
    size: number;
    type: 'file' | 'dir' | 'submodule' | 'symlink';
    htmlUrl: string;
}

export async function listDirectory(
    client: Octokit,
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
): Promise<DirectoryEntry[]> {
    try {
        const { data } = await client.repos.getContent({
            owner,
            repo,
            path,
            ref,
        });

        // Handle case where path is a file, not a directory
        if (!Array.isArray(data)) {
            throw new Error(`Path "${path}" is a file, not a directory. Use readFile to get file contents.`);
        }

        return data.map((item) => ({
            name: item.name,
            path: item.path,
            sha: item.sha,
            size: item.size || 0,
            type: item.type as 'file' | 'dir' | 'submodule' | 'symlink',
            htmlUrl: item.html_url || '',
        }));
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`Directory not found: ${path || '(root)'}`);
        }
        logger.error('Failed to list directory', { owner, repo, path, error: error.message });
        throw error;
    }
}

/**
 * Get the repository tree (for deeper exploration)
 */
export interface TreeEntry {
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url: string;
}

export async function getTree(
    client: Octokit,
    owner: string,
    repo: string,
    treeSha: string,
    recursive: boolean = false
): Promise<{ tree: TreeEntry[]; truncated: boolean }> {
    try {
        const { data } = await client.git.getTree({
            owner,
            repo,
            tree_sha: treeSha,
            recursive: recursive ? '1' : undefined,
        });

        return {
            tree: data.tree.map((item) => ({
                path: item.path || '',
                mode: item.mode || '',
                type: item.type as 'blob' | 'tree',
                sha: item.sha || '',
                size: item.size,
                url: item.url || '',
            })),
            truncated: data.truncated || false,
        };
    } catch (error: any) {
        logger.error('Failed to get tree', { owner, repo, treeSha, error: error.message });
        throw error;
    }
}

/**
 * Get branch information
 */
export async function getBranch(
    client: Octokit,
    owner: string,
    repo: string,
    branch: string
): Promise<{ treeSha: string; commitSha: string }> {
    const { data } = await client.repos.getBranch({
        owner,
        repo,
        branch,
    });

    return {
        treeSha: data.commit.commit.tree.sha,
        commitSha: data.commit.sha,
    };
}

/**
 * Parse a repository full name into owner and repo
 */
export function parseRepoFullName(fullName: string): { owner: string; repo: string } {
    const [owner, repo] = fullName.split('/');
    if (!owner || !repo) {
        throw new Error(`Invalid repository name format: ${fullName}. Expected "owner/repo".`);
    }
    return { owner, repo };
}

/**
 * Pull request information
 */
export interface PullRequestInfo {
    number: number;
    title: string;
    state: 'open' | 'closed';
    merged: boolean;
    mergedAt: string | null;
    createdAt: string;
    closedAt: string | null;
    author: string;
    htmlUrl: string;
    body: string | null;
    additions: number;
    deletions: number;
    changedFiles: number;
    labels: string[];
    baseBranch: string;
    headBranch: string;
}

/**
 * List pull requests for a repository within a time window
 * Dates are in YYYY-MM-DD format and are normalized to start/end of day
 */
export async function listPullRequests(
    client: Octokit,
    owner: string,
    repo: string,
    options: {
        state?: 'open' | 'closed' | 'all';
        since?: string; // Date string in YYYY-MM-DD format (normalized to start of day)
        until?: string; // Date string in YYYY-MM-DD format (normalized to end of day)
        perPage?: number;
        page?: number;
    } = {}
): Promise<{ items: PullRequestInfo[]; totalFetched: number; pagination: { page: number; perPage: number; hasMore: boolean } }> {
    const { state = 'all', since, until, perPage = 30, page = 1 } = options;

    try {
        const { data, headers } = await client.pulls.list({
            owner,
            repo,
            state,
            sort: 'updated',
            direction: 'desc',
            per_page: perPage,
            page,
        });

        // Filter by date range if specified
        let filteredPRs = data;
        
        if (since || until) {
            let sinceDate: Date | null = null;
            let untilDate: Date | null = null;
            
            if (since) {
                const trimmedSince = since.trim();
                const parsedSince = DateTime.fromISO(trimmedSince);
                if (parsedSince.isValid) {
                    // Always normalize to start of day (00:00:00)
                    sinceDate = parsedSince.startOf('day').toJSDate();
                } else {
                    // Fallback to native Date parsing if Luxon can't parse it, then normalize to start of day
                    const fallbackDate = DateTime.fromJSDate(new Date(since));
                    sinceDate = fallbackDate.isValid ? fallbackDate.startOf('day').toJSDate() : new Date(since);
                }
            }
            
            if (until) {
                const trimmedUntil = until.trim();
                const parsedUntil = DateTime.fromISO(trimmedUntil);
                if (parsedUntil.isValid) {
                    // Always normalize to end of day (23:59:59.999)
                    untilDate = parsedUntil.endOf('day').toJSDate();
                } else {
                    // Fallback to native Date parsing if Luxon can't parse it, then normalize to end of day
                    const fallbackDate = DateTime.fromJSDate(new Date(until));
                    untilDate = fallbackDate.isValid ? fallbackDate.endOf('day').toJSDate() : new Date(until);
                }
            }

            filteredPRs = data.filter((pr) => {
                // For merged PRs, use merged_at; for others, use updated_at
                const relevantDate = pr.merged_at 
                    ? new Date(pr.merged_at) 
                    : (pr.closed_at ? new Date(pr.closed_at) : new Date(pr.updated_at));
                
                if (sinceDate && relevantDate < sinceDate) return false;
                if (untilDate && relevantDate > untilDate) return false;
                return true;
            });
        }

        const items: PullRequestInfo[] = filteredPRs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            state: pr.state as 'open' | 'closed',
            merged: pr.merged_at !== null,
            mergedAt: pr.merged_at,
            createdAt: pr.created_at,
            closedAt: pr.closed_at,
            author: pr.user?.login || 'unknown',
            htmlUrl: pr.html_url,
            body: pr.body,
            additions: 0, // Not available in list endpoint
            deletions: 0,
            changedFiles: 0,
            labels: pr.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
            baseBranch: pr.base.ref,
            headBranch: pr.head.ref,
        }));

        // Check if there are more pages by examining the Link header
        const isDateFiltered = !!(since || until);
        let hasMore = false;
        const linkHeader = headers.link;
        const hasNextPage = !!(linkHeader && linkHeader.includes('rel="next"'));
        const gotFullPageFromAPI = data.length === perPage;
        
        if (isDateFiltered) {
            // With client-side filtering, if the API has more pages, there could be matching results
            // on those pages. We can't know without fetching them, so we indicate hasMore = true
            // if the API has more pages. This ensures users don't miss results that might exist
            // on subsequent pages, even if the current page had few matches after filtering.
            hasMore = hasNextPage;
        } else {
            // Without filtering, use the standard logic
            if (hasNextPage) {
                hasMore = true;
            } else if (gotFullPageFromAPI) {
                // If we got exactly perPage results, there might be more
                // But without a Link header, we can't be certain, so we'll be conservative
                // and assume there might be more if we got a full page
                hasMore = true;
            }
        }

        return {
            items,
            totalFetched: items.length,
            pagination: {
                page,
                perPage,
                hasMore,
            },
        };
    } catch (error: any) {
        logger.error('Failed to list pull requests', { owner, repo, error: error.message });
        throw error;
    }
}

/**
 * Pull request diff information
 */
export interface PullRequestDiff {
    number: number;
    title: string;
    state: 'open' | 'closed';
    merged: boolean;
    baseBranch: string;
    headBranch: string;
    diff: string; // Unified diff format
    filesChanged: Array<{
        filename: string;
        status: 'added' | 'removed' | 'modified' | 'renamed';
        additions: number;
        deletions: number;
        changes: number;
        patch?: string; // File-specific diff patch
    }>;
    additions: number;
    deletions: number;
    totalChanges: number;
    htmlUrl: string;
    pagination: {
        page: number;
        perPage: number;
        hasMore: boolean;
    };
}

/**
 * Get the diff of a pull request
 */
export async function getPullRequestDiff(
    client: Octokit,
    owner: string,
    repo: string,
    pullNumber: number,
    options: {
        page?: number;
        perPage?: number;
    } = {}
): Promise<PullRequestDiff> {
    const { page = 1, perPage = 100 } = options;
    try {
        // Get PR details (without diff format)
        const { data: pr } = await client.pulls.get({
            owner,
            repo,
            pull_number: pullNumber,
        });

        // Get PR diff using mediaType format
        // Note: When using mediaType.format: 'diff', the response data is a string, not the PR object
        const diffResponse = await client.pulls.get({
            owner,
            repo,
            pull_number: pullNumber,
            mediaType: {
                format: 'diff',
            },
        });
        // TypeScript doesn't know that data is a string when using diff format, so we cast it
        const diff = diffResponse.data as unknown as string;

        // Get PR files to get detailed file information
        // Fetch a single page of files (per_page: 100 is the maximum)
        const { data: files, headers } = await client.pulls.listFiles({
            owner,
            repo,
            pull_number: pullNumber,
            per_page: perPage,
            page,
        });

        // Check if there are more pages by examining the Link header
        let hasMore = false;
        const linkHeader = headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
            hasMore = true;
        } else if (files.length === perPage) {
            // If we got exactly perPage results, there might be more
            // But without a Link header, we can't be certain, so we'll be conservative
            // and assume there might be more if we got a full page
            hasMore = true;
        }

        const filesChanged = files.map((file) => ({
            filename: file.filename,
            status: file.status as 'added' | 'removed' | 'modified' | 'renamed',
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch || undefined,
        }));

        return {
            number: pr.number,
            title: pr.title,
            state: pr.state as 'open' | 'closed',
            merged: pr.merged_at !== null,
            baseBranch: pr.base.ref,
            headBranch: pr.head.ref,
            diff,
            filesChanged,
            additions: pr.additions,
            deletions: pr.deletions,
            totalChanges: pr.additions + pr.deletions,
            htmlUrl: pr.html_url,
            pagination: {
                page,
                perPage,
                hasMore,
            },
        };
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`Pull request #${pullNumber} not found`);
        }
        logger.error('Failed to get pull request diff', { owner, repo, pullNumber, error: error.message });
        throw error;
    }
}

/**
 * Commit information
 */
export interface CommitInfo {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    authorEmail: string;
    date: string;
    htmlUrl: string;
    additions: number;
    deletions: number;
    filesChanged: number;
}

/**
 * List commits for a repository within a time window
 */
export async function listCommits(
    client: Octokit,
    owner: string,
    repo: string,
    options: {
        since?: string; // ISO date string
        until?: string; // ISO date string
        sha?: string; // Branch name or commit SHA to start from
        path?: string; // Only commits affecting this file/directory
        author?: string; // Filter by author
        perPage?: number;
        page?: number;
    } = {}
): Promise<{ items: CommitInfo[]; totalFetched: number }> {
    const { since, until, sha, path, author, perPage = 30, page = 1 } = options;

    try {
        const { data } = await client.repos.listCommits({
            owner,
            repo,
            since,
            until,
            sha,
            path,
            author,
            per_page: perPage,
            page,
        });

        const items: CommitInfo[] = data.map((commit) => ({
            sha: commit.sha,
            shortSha: commit.sha.slice(0, 7),
            message: commit.commit.message,
            author: commit.commit.author?.name || commit.author?.login || 'unknown',
            authorEmail: commit.commit.author?.email || '',
            date: commit.commit.author?.date || '',
            htmlUrl: commit.html_url,
            additions: commit.stats?.additions || 0,
            deletions: commit.stats?.deletions || 0,
            filesChanged: commit.files?.length || 0,
        }));

        return {
            items,
            totalFetched: items.length,
        };
    } catch (error: any) {
        logger.error('Failed to list commits', { owner, repo, error: error.message });
        throw error;
    }
}

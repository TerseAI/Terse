import { Octokit } from "@octokit/rest"
import type { RestEndpointMethodTypes } from "@octokit/rest"
import { DateTime } from "luxon"
import { GitHubConfig, IntegrationType } from "terse-types"

import logger from "../../common/logger"
import { db } from "../../loaders/prisma"
import { SecretService } from "../../services/SecretService"

/**
 * Creates an authenticated Octokit client
 */
export function createGitHubClient(accessToken: string): Octokit {
    return new Octokit({
        auth: accessToken
    })
}

export async function getGitHubAccessToken(userId: string, organizationId: string): Promise<string | null> {
    const githubToken = await db().github_app_tokens.findFirst({
        where: { user_id: userId, organization_id: organizationId }
    })

    if (!githubToken) {
        logger.warn("No GitHub OAuth token found for user in organization", { userId, organizationId })
        return null
    }

    const secretService = SecretService.getInstance()
    const secrets = await secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: githubToken.id } })
    return secrets?.accessToken ?? null
}

/**
 * Get repository information including the default branch
 */
export async function getRepositoryInfo(client: Octokit, owner: string, repo: string): Promise<{ id: number; fullName: string; defaultBranch: string } | null> {
    try {
        const { data } = await client.repos.get({ owner, repo })
        return {
            id: data.id,
            fullName: data.full_name,
            defaultBranch: data.default_branch
        }
    } catch (error: any) {
        logger.error("Failed to get repository info", { owner, repo, error: error.message })
        return null
    }
}

/**
 * Resolve repository full names from repository IDs.
 */
export async function getRepositoryNamesByIds(client: Octokit, repositoryIds: number[]): Promise<Map<number, string>> {
    const uniqueRepoIds = [...new Set(repositoryIds)].filter(id => Number.isInteger(id) && id > 0)
    if (uniqueRepoIds.length === 0) {
        return new Map()
    }

    const pairs = await Promise.all(
        uniqueRepoIds.map(async repoId => {
            try {
                const { data } = await client.request("GET /repositories/{repository_id}", { repository_id: repoId })
                return [repoId, data.full_name] as const
            } catch (error: any) {
                logger.warn("Failed to resolve repository name from ID", {
                    repoId,
                    error: error?.message ?? String(error)
                })
                return null
            }
        })
    )

    return new Map(pairs.filter((pair): pair is readonly [number, string] => pair !== null))
}

export async function getAllowedRepoNamesForConfigs(configs: GitHubConfig[], userId: string, organizationId: string): Promise<Set<string>> {
    const ids = Array.from(new Set(configs.flatMap(c => c.repositoryIds ?? []))).sort((a, b) => a - b)
    const token = await getGitHubAccessToken(userId, organizationId)
    if (!token) return new Set<string>()
    const client = createGitHubClient(token)
    const map = await getRepositoryNamesByIds(client, ids)
    return new Set(map.values())
}

/**
 * Search code in GitHub repositories
 */
export interface CodeSearchResult {
    name: string
    path: string
    sha: string
    url: string
    htmlUrl: string
    repository: {
        id: number
        fullName: string
    }
    textMatches?: {
        fragment: string
        matches: { text: string; indices: number[] }[]
    }[]
}

export async function searchCode(
    client: Octokit,
    query: string,
    repositories: string[], // owner/repo format
    options: {
        perPage?: number
        page?: number
    } = {}
): Promise<{ items: CodeSearchResult[]; totalCount: number; pagination: { page: number; perPage: number; hasMore: boolean } }> {
    const { perPage = 30, page = 1 } = options

    // Build the repo filter
    const repoFilter = repositories.map(repo => `repo:${repo}`).join(" ")
    const fullQuery = `${query} ${repoFilter}`

    try {
        const { data, headers } = await client.search.code({
            q: fullQuery,
            per_page: perPage,
            page,
            headers: {
                // Request text-match metadata for highlighted snippets
                accept: "application/vnd.github.text-match+json"
            }
        })

        // Check if there are more pages by examining the Link header
        let hasMore = false
        const linkHeader = headers.link
        if (linkHeader && linkHeader.includes('rel="next"')) {
            hasMore = true
        } else if (data.items.length === perPage) {
            // If we got exactly perPage results, there might be more
            // But without a Link header, we can't be certain, so we'll be conservative
            // and assume there might be more if we got a full page
            hasMore = true
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
                    fullName: item.repository.full_name
                },
                textMatches: item.text_matches?.map((match: any) => ({
                    fragment: match.fragment,
                    matches: match.matches
                }))
            })),
            pagination: {
                page,
                perPage,
                hasMore
            }
        }
    } catch (error: any) {
        if (error.status === 422) {
            logger.warn("GitHub code search validation error", { query: fullQuery, error: error.message })
            throw new Error("Search query is too complex or invalid. Try simplifying your search.")
        }
        if (error.status === 403) {
            logger.warn("GitHub API rate limit or access denied", { error: error.message })
            throw new Error("GitHub API rate limit exceeded or access denied.")
        }
        logger.error("GitHub code search failed", { query: fullQuery, error: error.message })
        throw error
    }
}

/**
 * Get file contents from a GitHub repository
 */
export interface FileContent {
    name: string
    path: string
    sha: string
    size: number
    content: string // Decoded content
    encoding: string
    htmlUrl: string
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
            ref
        })

        // Handle files (not directories)
        if (Array.isArray(data)) {
            throw new Error(`Path "${path}" is a directory, not a file. Use listDirectory to explore directories.`)
        }

        if (data.type !== "file") {
            throw new Error(`Path "${path}" is a ${data.type}, not a file. Use listDirectory to explore directories.`)
        }

        // Decode base64 content
        let content = ""
        if ("content" in data && data.content && data.encoding === "base64") {
            content = Buffer.from(data.content, "base64").toString("utf-8")
        }

        return {
            name: data.name,
            path: data.path,
            sha: data.sha,
            size: data.size,
            content,
            encoding: data.encoding || "base64",
            htmlUrl: data.html_url || ""
        }
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`File not found: ${path}`)
        }
        logger.error("Failed to get file contents", { owner, repo, path, error: error.message })
        throw error
    }
}

/**
 * List directory contents in a GitHub repository
 */
export interface DirectoryEntry {
    name: string
    path: string
    sha: string
    size: number
    type: "file" | "dir" | "submodule" | "symlink"
    htmlUrl: string
}

export async function listDirectory(client: Octokit, owner: string, repo: string, path: string = "", ref?: string): Promise<DirectoryEntry[]> {
    try {
        const { data } = await client.repos.getContent({
            owner,
            repo,
            path,
            ref
        })

        // Handle case where path is a file, not a directory
        if (!Array.isArray(data)) {
            throw new Error(`Path "${path}" is a file, not a directory. Use readFile to get file contents.`)
        }

        return data.map(item => ({
            name: item.name,
            path: item.path,
            sha: item.sha,
            size: item.size || 0,
            type: item.type as "file" | "dir" | "submodule" | "symlink",
            htmlUrl: item.html_url || ""
        }))
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`Directory not found: ${path || "(root)"}`)
        }
        logger.error("Failed to list directory", { owner, repo, path, error: error.message })
        throw error
    }
}

/**
 * Get the repository tree (for deeper exploration)
 */
export interface TreeEntry {
    path: string
    mode: string
    type: "blob" | "tree"
    sha: string
    size?: number
    url: string
}

export async function getTree(client: Octokit, owner: string, repo: string, treeSha: string, recursive: boolean = false): Promise<{ tree: TreeEntry[]; truncated: boolean }> {
    try {
        const { data } = await client.git.getTree({
            owner,
            repo,
            tree_sha: treeSha,
            recursive: recursive ? "1" : undefined
        })

        return {
            tree: data.tree.map(item => ({
                path: item.path || "",
                mode: item.mode || "",
                type: item.type as "blob" | "tree",
                sha: item.sha || "",
                size: item.size,
                url: item.url || ""
            })),
            truncated: data.truncated || false
        }
    } catch (error: any) {
        logger.error("Failed to get tree", { owner, repo, treeSha, error: error.message })
        throw error
    }
}

/**
 * Get branch information
 */
export async function getBranch(client: Octokit, owner: string, repo: string, branch: string): Promise<{ treeSha: string; commitSha: string }> {
    const { data } = await client.repos.getBranch({
        owner,
        repo,
        branch
    })

    return {
        treeSha: data.commit.commit.tree.sha,
        commitSha: data.commit.sha
    }
}

/**
 * Parse a repository full name into owner and repo
 */
export function parseRepoFullName(fullName: string): { owner: string; repo: string } {
    const [owner, repo] = fullName.split("/")
    if (!owner || !repo) {
        throw new Error(`Invalid repository name format: ${fullName}. Expected "owner/repo".`)
    }
    return { owner, repo }
}

/**
 * Pull request information
 */
export interface PullRequestInfo {
    number: number
    title: string
    state: "open" | "closed"
    merged: boolean
    mergedAt: string | null
    createdAt: string
    closedAt: string | null
    author: string
    htmlUrl: string
    body: string | null
    additions: number
    deletions: number
    changedFiles: number
    labels: string[]
    baseBranch: string
    headBranch: string
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
        state?: "open" | "closed" | "all"
        since?: string // Date string in YYYY-MM-DD format (normalized to start of day)
        until?: string // Date string in YYYY-MM-DD format (normalized to end of day)
        perPage?: number
        page?: number
    } = {}
): Promise<{ items: PullRequestInfo[]; totalFetched: number; pagination: { page: number; perPage: number; hasMore: boolean } }> {
    const { state = "all", since, until, perPage = 30, page = 1 } = options

    try {
        const { data, headers } = await client.pulls.list({
            owner,
            repo,
            state,
            sort: "updated",
            direction: "desc",
            per_page: perPage,
            page
        })

        // Filter by date range if specified
        let filteredPRs = data

        if (since || until) {
            let sinceDate: Date | null = null
            let untilDate: Date | null = null

            if (since) {
                const trimmedSince = since.trim()
                const parsedSince = DateTime.fromISO(trimmedSince)
                if (parsedSince.isValid) {
                    // Always normalize to start of day (00:00:00)
                    sinceDate = parsedSince.startOf("day").toJSDate()
                } else {
                    // Fallback to native Date parsing if Luxon can't parse it, then normalize to start of day
                    const fallbackDate = DateTime.fromJSDate(new Date(since))
                    sinceDate = fallbackDate.isValid ? fallbackDate.startOf("day").toJSDate() : new Date(since)
                }
            }

            if (until) {
                const trimmedUntil = until.trim()
                const parsedUntil = DateTime.fromISO(trimmedUntil)
                if (parsedUntil.isValid) {
                    // Always normalize to end of day (23:59:59.999)
                    untilDate = parsedUntil.endOf("day").toJSDate()
                } else {
                    // Fallback to native Date parsing if Luxon can't parse it, then normalize to end of day
                    const fallbackDate = DateTime.fromJSDate(new Date(until))
                    untilDate = fallbackDate.isValid ? fallbackDate.endOf("day").toJSDate() : new Date(until)
                }
            }

            filteredPRs = data.filter(pr => {
                // For merged PRs, use merged_at; for others, use updated_at
                const relevantDate = pr.merged_at ? new Date(pr.merged_at) : pr.closed_at ? new Date(pr.closed_at) : new Date(pr.updated_at)

                if (sinceDate && relevantDate < sinceDate) return false
                if (untilDate && relevantDate > untilDate) return false
                return true
            })
        }

        const items: PullRequestInfo[] = filteredPRs.map(pr => ({
            number: pr.number,
            title: pr.title,
            state: pr.state as "open" | "closed",
            merged: pr.merged_at !== null,
            mergedAt: pr.merged_at,
            createdAt: pr.created_at,
            closedAt: pr.closed_at,
            author: pr.user?.login || "unknown",
            htmlUrl: pr.html_url,
            body: pr.body,
            additions: 0, // Not available in list endpoint
            deletions: 0,
            changedFiles: 0,
            labels: pr.labels.map(l => (typeof l === "string" ? l : l.name || "")),
            baseBranch: pr.base.ref,
            headBranch: pr.head.ref
        }))

        // Check if there are more pages by examining the Link header
        const isDateFiltered = !!(since || until)
        let hasMore = false
        const linkHeader = headers.link
        const hasNextPage = !!(linkHeader && linkHeader.includes('rel="next"'))
        const gotFullPageFromAPI = data.length === perPage

        if (isDateFiltered) {
            // With client-side filtering, if the API has more pages, there could be matching results
            // on those pages. We can't know without fetching them, so we indicate hasMore = true
            // if the API has more pages. This ensures users don't miss results that might exist
            // on subsequent pages, even if the current page had few matches after filtering.
            hasMore = hasNextPage
        } else {
            // Without filtering, use the standard logic
            if (hasNextPage) {
                hasMore = true
            } else if (gotFullPageFromAPI) {
                // If we got exactly perPage results, there might be more
                // But without a Link header, we can't be certain, so we'll be conservative
                // and assume there might be more if we got a full page
                hasMore = true
            }
        }

        return {
            items,
            totalFetched: items.length,
            pagination: {
                page,
                perPage,
                hasMore
            }
        }
    } catch (error: any) {
        logger.error("Failed to list pull requests", { owner, repo, error: error.message })
        throw error
    }
}

/**
 * Pull request diff information
 */
export interface PullRequestDiff {
    number: number
    title: string
    state: "open" | "closed"
    merged: boolean
    baseBranch: string
    headBranch: string
    diff: string // Unified diff format
    filesChanged: Array<{
        filename: string
        status: "added" | "removed" | "modified" | "renamed"
        additions: number
        deletions: number
        changes: number
        patch?: string // File-specific diff patch
    }>
    additions: number
    deletions: number
    totalChanges: number
    htmlUrl: string
    pagination: {
        page: number
        perPage: number
        hasMore: boolean
    }
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
        page?: number
        perPage?: number
    } = {}
): Promise<PullRequestDiff> {
    const { page = 1, perPage = 100 } = options
    try {
        // Get PR details (without diff format)
        const { data: pr } = await client.pulls.get({
            owner,
            repo,
            pull_number: pullNumber
        })

        // Get PR diff using mediaType format
        // Note: When using mediaType.format: 'diff', the response data is a string, not the PR object
        const diffResponse = await client.pulls.get({
            owner,
            repo,
            pull_number: pullNumber,
            mediaType: {
                format: "diff"
            }
        })
        // TypeScript doesn't know that data is a string when using diff format, so we cast it
        const diff = diffResponse.data as unknown as string

        // Get PR files to get detailed file information
        // Fetch a single page of files (per_page: 100 is the maximum)
        const { data: files, headers } = await client.pulls.listFiles({
            owner,
            repo,
            pull_number: pullNumber,
            per_page: perPage,
            page
        })

        // Check if there are more pages by examining the Link header
        let hasMore = false
        const linkHeader = headers.link
        if (linkHeader && linkHeader.includes('rel="next"')) {
            hasMore = true
        } else if (files.length === perPage) {
            // If we got exactly perPage results, there might be more
            // But without a Link header, we can't be certain, so we'll be conservative
            // and assume there might be more if we got a full page
            hasMore = true
        }

        const filesChanged = files.map(file => ({
            filename: file.filename,
            status: file.status as "added" | "removed" | "modified" | "renamed",
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch || undefined
        }))

        return {
            number: pr.number,
            title: pr.title,
            state: pr.state as "open" | "closed",
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
                hasMore
            }
        }
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`Pull request #${pullNumber} not found`)
        }
        logger.error("Failed to get pull request diff", { owner, repo, pullNumber, error: error.message })
        throw error
    }
}

/**
 * Issue information. Reaction counts are flattened out of GitHub's `reactions` rollup
 * so callers can rank by 👍 without reaching into keys named `+1` / `-1`.
 */
export interface ReactionCounts {
    total: number
    plusOne: number
    minusOne: number
    laugh: number
    hooray: number
    confused: number
    heart: number
    rocket: number
    eyes: number
}

export interface IssueInfo {
    number: number
    title: string
    body: string | null
    state: "open" | "closed"
    author: string
    labels: string[]
    assignees: string[]
    comments: number
    reactions: ReactionCounts
    createdAt: string
    updatedAt: string
    closedAt: string | null
    htmlUrl: string
    repositoryFullName: string
}

const EMPTY_REACTION_COUNTS: ReactionCounts = {
    total: 0,
    plusOne: 0,
    minusOne: 0,
    laugh: 0,
    hooray: 0,
    confused: 0,
    heart: 0,
    rocket: 0,
    eyes: 0
}

type OctokitReactionRollup = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][number]["reactions"]

function toReactionCounts(reactions: OctokitReactionRollup): ReactionCounts {
    if (!reactions) return EMPTY_REACTION_COUNTS
    return {
        total: reactions.total_count,
        plusOne: reactions["+1"],
        minusOne: reactions["-1"],
        laugh: reactions.laugh,
        hooray: reactions.hooray,
        confused: reactions.confused,
        heart: reactions.heart,
        rocket: reactions.rocket,
        eyes: reactions.eyes
    }
}

function toLabelNames(labels: RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][number]["labels"]): string[] {
    return labels.map(label => (typeof label === "string" ? label : (label.name ?? ""))).filter(Boolean)
}

/**
 * Derive the repository full name from an issue's API url, which is always of the form
 * `https://api.github.com/repos/{owner}/{repo}/issues/{number}`. Search results carry no
 * repository object, so this is the only reliable source there.
 */
function repositoryFullNameFromIssueUrl(url: string): string {
    const match = url.match(/\/repos\/([^/]+\/[^/]+)\//)
    return match ? match[1] : ""
}

export interface ListIssuesOptions {
    state?: "open" | "closed" | "all"
    labels?: string[]
    since?: string
    sort?: "created" | "updated" | "comments"
    direction?: "asc" | "desc"
    creator?: string
    assignee?: string
    perPage?: number
    page?: number
}

const ISSUES_API_PER_PAGE = 100
// Bounds the fan-out when a repository is dense in pull requests, which the issues endpoint
// returns alongside issues. Hitting the bound leaves `hasMore` true, so the caller can page on.
const ISSUES_MAX_API_PAGES_PER_CALL = 5

/**
 * List issues for a repository. GitHub's issues endpoint also returns pull requests and offers
 * no way to exclude them, so `page`/`perPage` are applied to the issues-only stream: we walk
 * whole API pages, drop the pull requests, and hand back a full page of real issues. Without
 * this, sorting by comment count on a PR-heavy repository returns empty pages.
 */
export async function listIssues(client: Octokit, owner: string, repo: string, options: ListIssuesOptions = {}): Promise<IssuePage> {
    const { perPage = 30, page = 1 } = options
    const skip = (page - 1) * perPage

    const collected: IssueInfo[] = []
    let skipped = 0
    let overflowed = false
    let apiPage = 1
    let apiHasMore = true

    while (apiHasMore && apiPage <= ISSUES_MAX_API_PAGES_PER_CALL && !overflowed) {
        const { issues, hasMore } = await fetchIssuePage(client, owner, repo, options, apiPage)
        for (const issue of issues) {
            if (skipped < skip) {
                skipped++
            } else if (collected.length < perPage) {
                collected.push(issue)
            } else {
                overflowed = true
                break
            }
        }
        apiHasMore = hasMore
        apiPage++
    }

    return {
        items: collected,
        pagination: { page, perPage, hasMore: overflowed || (apiHasMore && collected.length >= perPage) }
    }
}

async function fetchIssuePage(client: Octokit, owner: string, repo: string, options: ListIssuesOptions, apiPage: number): Promise<{ issues: IssueInfo[]; hasMore: boolean }> {
    const { state = "open", labels, since, sort = "created", direction = "desc", creator, assignee } = options

    try {
        const { data, headers } = await client.issues.listForRepo({
            owner,
            repo,
            state,
            labels: labels?.length ? labels.join(",") : undefined,
            since,
            sort,
            direction,
            creator,
            assignee,
            per_page: ISSUES_API_PER_PAGE,
            page: apiPage
        })

        return {
            issues: data.filter(issue => !issue.pull_request).map(issue => toIssueInfo(issue, `${owner}/${repo}`)),
            hasMore: hasNextPage(headers.link, data.length, ISSUES_API_PER_PAGE)
        }
    } catch (error: any) {
        logger.error("Failed to list issues", { owner, repo, apiPage, error: error.message })
        throw error
    }
}

type OctokitIssueListItem = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"][number]

function toIssueInfo(issue: OctokitIssueListItem, repositoryFullName: string): IssueInfo {
    return {
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: issue.state as "open" | "closed",
        author: issue.user?.login || "unknown",
        labels: toLabelNames(issue.labels),
        assignees: (issue.assignees ?? []).map(a => a.login),
        comments: issue.comments,
        reactions: toReactionCounts(issue.reactions),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        htmlUrl: issue.html_url,
        repositoryFullName
    }
}

/**
 * Search issues across repositories, ranked by the given engagement field.
 * The repository allowlist is applied here as `repo:` qualifiers, so callers must
 * sanitize any free-text query before it reaches this function.
 */
export async function searchIssues(
    client: Octokit,
    query: string,
    options: {
        sort?: "reactions-+1" | "reactions" | "comments" | "interactions" | "created" | "updated"
        order?: "asc" | "desc"
        perPage?: number
        page?: number
    } = {}
): Promise<{ items: IssueInfo[]; totalCount: number; pagination: { page: number; perPage: number; hasMore: boolean } }> {
    const { sort, order = "desc", perPage = 20, page = 1 } = options

    try {
        const { data, headers } = await client.search.issuesAndPullRequests({
            q: query,
            sort,
            order,
            per_page: perPage,
            page,
            advanced_search: "true"
        })

        const items: IssueInfo[] = data.items.map(issue => ({
            number: issue.number,
            title: issue.title,
            body: issue.body ?? null,
            state: issue.state as "open" | "closed",
            author: issue.user?.login || "unknown",
            labels: toLabelNames(issue.labels),
            assignees: (issue.assignees ?? []).map(a => a.login),
            comments: issue.comments,
            reactions: toReactionCounts(issue.reactions),
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
            closedAt: issue.closed_at,
            htmlUrl: issue.html_url,
            repositoryFullName: repositoryFullNameFromIssueUrl(issue.url)
        }))

        return {
            items,
            totalCount: data.total_count,
            pagination: { page, perPage, hasMore: hasNextPage(headers.link, data.items.length, perPage) }
        }
    } catch (error: any) {
        if (error.status === 422) {
            logger.warn("GitHub issue search validation error", { query, error: error.message })
            throw new Error("Search query is invalid. Try simplifying the query or removing filters.")
        }
        logger.error("GitHub issue search failed", { query, error: error.message })
        throw error
    }
}

/**
 * Discussion information
 */
export interface DiscussionInfo {
    number: number
    title: string
    body: string
    author: string
    category: string
    upvotes: number
    comments: number
    isAnswered: boolean
    createdAt: string
    updatedAt: string
    htmlUrl: string
}

export interface DiscussionCategoryInfo {
    id: string
    name: string
    slug: string
    isAnswerable: boolean
}

const DISCUSSIONS_QUERY = `
query Discussions($owner: String!, $repo: String!, $first: Int!, $after: String, $categoryId: ID, $orderBy: DiscussionOrderField!, $direction: OrderDirection!) {
    repository(owner: $owner, name: $repo) {
        discussionCategories(first: 25) {
            nodes { id name slug isAnswerable }
        }
        discussions(first: $first, after: $after, categoryId: $categoryId, orderBy: { field: $orderBy, direction: $direction }) {
            pageInfo { hasNextPage endCursor }
            nodes {
                number
                title
                body
                url
                createdAt
                updatedAt
                upvoteCount
                isAnswered
                author { login }
                category { name }
                comments { totalCount }
            }
        }
    }
}`

/**
 * List GitHub Discussions. Discussions have no REST endpoint, so this is the one
 * GitHub capability here that goes through GraphQL.
 */
export async function listDiscussions(
    client: Octokit,
    owner: string,
    repo: string,
    options: {
        category?: string
        orderBy?: "CREATED_AT" | "UPDATED_AT"
        direction?: "ASC" | "DESC"
        perPage?: number
        cursor?: string
    } = {}
): Promise<{ items: DiscussionInfo[]; categories: DiscussionCategoryInfo[]; pagination: { perPage: number; hasMore: boolean; endCursor?: string } }> {
    const { category, orderBy = "CREATED_AT", direction = "DESC", perPage = 20, cursor } = options

    const categories = await listDiscussionCategories(client, owner, repo)
    const categoryId = category ? findDiscussionCategoryId(categories, category) : undefined
    if (category && !categoryId) {
        throw new Error(`Discussion category "${category}" not found in ${owner}/${repo}. Available categories: ${categories.map(c => c.name).join(", ") || "(none)"}`)
    }

    const response = await runDiscussionsQuery(client, {
        owner,
        repo,
        first: perPage,
        after: cursor ?? null,
        categoryId: categoryId ?? null,
        orderBy,
        direction
    })

    const discussions = response.repository?.discussions
    if (!discussions) {
        throw new Error(`Discussions are not enabled for ${owner}/${repo}.`)
    }

    return {
        items: discussions.nodes.map(node => ({
            number: node.number,
            title: node.title,
            body: node.body ?? "",
            author: node.author?.login ?? "unknown",
            category: node.category?.name ?? "",
            upvotes: node.upvoteCount,
            comments: node.comments.totalCount,
            isAnswered: node.isAnswered ?? false,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            htmlUrl: node.url
        })),
        categories: response.repository?.discussionCategories.nodes ?? categories,
        pagination: {
            perPage,
            hasMore: discussions.pageInfo.hasNextPage,
            endCursor: discussions.pageInfo.endCursor ?? undefined
        }
    }
}

async function runDiscussionsQuery(client: Octokit, variables: DiscussionsQueryVariables): Promise<DiscussionsQueryResponse> {
    try {
        return await client.graphql<DiscussionsQueryResponse>(DISCUSSIONS_QUERY, { ...variables })
    } catch (error: any) {
        logger.error("Failed to list discussions", { owner: variables.owner, repo: variables.repo, error: error.message })
        throw error
    }
}

async function listDiscussionCategories(client: Octokit, owner: string, repo: string): Promise<DiscussionCategoryInfo[]> {
    const response = await runDiscussionCategoriesQuery(client, owner, repo)
    return response.repository?.discussionCategories.nodes ?? []
}

async function runDiscussionCategoriesQuery(client: Octokit, owner: string, repo: string): Promise<DiscussionCategoriesQueryResponse> {
    try {
        return await client.graphql<DiscussionCategoriesQueryResponse>(
            `query DiscussionCategories($owner: String!, $repo: String!) {
                repository(owner: $owner, name: $repo) {
                    discussionCategories(first: 25) { nodes { id name slug isAnswerable } }
                }
            }`,
            { owner, repo }
        )
    } catch (error: any) {
        logger.error("Failed to list discussion categories", { owner, repo, error: error.message })
        throw error
    }
}

function findDiscussionCategoryId(categories: DiscussionCategoryInfo[], category: string): string | undefined {
    const normalized = category.trim().toLowerCase()
    return categories.find(c => c.name.toLowerCase() === normalized || c.slug.toLowerCase() === normalized)?.id
}

/**
 * Comparison between two refs (branches, tags, or commit SHAs)
 */
export interface CommitComparison {
    status: string
    aheadBy: number
    behindBy: number
    totalCommits: number
    additions: number
    deletions: number
    commits: CommitInfo[]
    files: Array<{
        filename: string
        status: string
        additions: number
        deletions: number
        changes: number
    }>
    htmlUrl: string
    pagination: { page: number; perPage: number; hasMore: boolean }
}

/**
 * Compare two refs. `files` is only populated on the first page, because GitHub returns
 * the full file list with every page of commits.
 */
export async function compareCommits(client: Octokit, owner: string, repo: string, base: string, head: string, options: { perPage?: number; page?: number } = {}): Promise<CommitComparison> {
    const { perPage = 50, page = 1 } = options

    try {
        const { data } = await client.repos.compareCommitsWithBasehead({
            owner,
            repo,
            basehead: `${base}...${head}`,
            per_page: perPage,
            page
        })

        const files = page === 1 ? (data.files ?? []) : []

        return {
            status: data.status,
            aheadBy: data.ahead_by,
            behindBy: data.behind_by,
            totalCommits: data.total_commits,
            additions: files.reduce((sum, file) => sum + file.additions, 0),
            deletions: files.reduce((sum, file) => sum + file.deletions, 0),
            commits: data.commits.map(toCommitInfo),
            files: files.map(file => ({
                filename: file.filename,
                status: file.status,
                additions: file.additions,
                deletions: file.deletions,
                changes: file.changes
            })),
            htmlUrl: data.html_url,
            pagination: { page, perPage, hasMore: data.commits.length === perPage && page * perPage < data.total_commits }
        }
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`Could not compare "${base}...${head}" in ${owner}/${repo}. Check that both refs exist.`)
        }
        logger.error("Failed to compare commits", { owner, repo, base, head, error: error.message })
        throw error
    }
}

/**
 * Repository counters at a point in time
 */
export interface RepositoryStats {
    id: number
    fullName: string
    description: string
    stars: number
    forks: number
    watchers: number
    openIssues: number
    defaultBranch: string
    language: string
    topics: string[]
    license: string
    isPrivate: boolean
    isArchived: boolean
    isFork: boolean
    createdAt: string
    updatedAt: string
    pushedAt: string
    htmlUrl: string
}

export async function getRepositoryStats(client: Octokit, owner: string, repo: string): Promise<RepositoryStats> {
    try {
        const { data } = await client.repos.get({ owner, repo })
        return {
            id: data.id,
            fullName: data.full_name,
            description: data.description ?? "",
            stars: data.stargazers_count,
            forks: data.forks_count,
            // GitHub's `watchers_count` mirrors the star count; `subscribers_count` is the real watcher total.
            watchers: data.subscribers_count ?? 0,
            openIssues: data.open_issues_count,
            defaultBranch: data.default_branch,
            language: data.language ?? "",
            topics: data.topics ?? [],
            license: data.license?.spdx_id ?? "",
            isPrivate: data.private,
            isArchived: data.archived,
            isFork: data.fork,
            createdAt: data.created_at ?? "",
            updatedAt: data.updated_at ?? "",
            pushedAt: data.pushed_at ?? "",
            htmlUrl: data.html_url
        }
    } catch (error: any) {
        if (error.status === 404) {
            throw new Error(`Repository ${owner}/${repo} not found`)
        }
        logger.error("Failed to get repository stats", { owner, repo, error: error.message })
        throw error
    }
}

/**
 * Commit information
 */
export interface CommitInfo {
    sha: string
    shortSha: string
    message: string
    author: string
    authorEmail: string
    date: string
    htmlUrl: string
    additions: number
    deletions: number
    filesChanged: number
}

/**
 * List commits for a repository within a time window
 */
export async function listCommits(
    client: Octokit,
    owner: string,
    repo: string,
    options: {
        since?: string // ISO date string
        until?: string // ISO date string
        sha?: string // Branch name or commit SHA to start from
        path?: string // Only commits affecting this file/directory
        author?: string // Filter by author
        perPage?: number
        page?: number
    } = {}
): Promise<{ items: CommitInfo[]; totalFetched: number }> {
    const { since, until, sha, path, author, perPage = 30, page = 1 } = options

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
            page
        })

        const items: CommitInfo[] = data.map(toCommitInfo)

        return {
            items,
            totalFetched: items.length
        }
    } catch (error: any) {
        logger.error("Failed to list commits", { owner, repo, error: error.message })
        throw error
    }
}

type OctokitCommitListItem = RestEndpointMethodTypes["repos"]["listCommits"]["response"]["data"][number]

function toCommitInfo(commit: OctokitCommitListItem): CommitInfo {
    return {
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        message: commit.commit.message,
        author: commit.commit.author?.name || commit.author?.login || "unknown",
        authorEmail: commit.commit.author?.email || "",
        date: commit.commit.author?.date || "",
        htmlUrl: commit.html_url,
        additions: commit.stats?.additions || 0,
        deletions: commit.stats?.deletions || 0,
        filesChanged: commit.files?.length || 0
    }
}

/**
 * GitHub only sends a `rel="next"` link when it is certain more results exist. A full page
 * with no link header still might have more, so we report `hasMore` conservatively.
 */
function hasNextPage(linkHeader: string | undefined, returnedCount: number, perPage: number): boolean {
    if (linkHeader?.includes('rel="next"')) return true
    return returnedCount === perPage
}

export interface IssuePage {
    items: IssueInfo[]
    pagination: { page: number; perPage: number; hasMore: boolean }
}

type DiscussionsQueryVariables = {
    owner: string
    repo: string
    first: number
    after: string | null
    categoryId: string | null
    orderBy: "CREATED_AT" | "UPDATED_AT"
    direction: "ASC" | "DESC"
}

type DiscussionCategoriesQueryResponse = {
    repository: {
        discussionCategories: { nodes: DiscussionCategoryInfo[] }
    } | null
}

type DiscussionsQueryResponse = {
    repository: {
        discussionCategories: { nodes: DiscussionCategoryInfo[] }
        discussions: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null }
            nodes: Array<{
                number: number
                title: string
                body: string | null
                url: string
                createdAt: string
                updatedAt: string
                upvoteCount: number
                isAnswered: boolean | null
                author: { login: string } | null
                category: { name: string } | null
                comments: { totalCount: number }
            }>
        }
    } | null
}

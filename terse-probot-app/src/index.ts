import { Probot } from "probot"

import { safeErrorFields } from "./utility/safeError.js"
import { Commit, FileDiff, VectraInterface } from "./vectraInterface.js"

// Add this temporarily to debug what URL is being constructed
console.log("Environment variables:", {
    WEBHOOK_PROXY_URL: process.env.WEBHOOK_PROXY_URL,
    NODE_ENV: process.env.NODE_ENV
})

export default (app: Probot) => {
    console.log("Probot app starting up...")

    app.onAny(async context => {
        console.log("🔔 Event received:", context.name)
    })

    app.on("push", async context => {
        const { payload } = context
        const github = context.octokit

        console.log("🚀 Push event received!")

        let diffs: Commit[] = []
        const installationId = context.payload.installation?.id || 0

        // Get commit diffs
        for (const commit of payload.commits) {
            try {
                // Fetch commit details with diff
                const { data: commitData } = await github.rest.repos.getCommit({
                    owner: payload.repository.owner.login,
                    repo: payload.repository.name,
                    ref: commit.id
                })

                console.log(`Commit: ${commit.id}`)
                console.log(`Message: ${commit.message}`)
                console.log(`Files changed: ${commitData.files?.length}`)

                let fileDiffs: FileDiff[] = []
                // Inspect each changed file
                for (const file of commitData.files || []) {
                    // The actual diff patch
                    if (file.patch) {
                        fileDiffs.push({
                            filename: file.filename,
                            diff: file.patch
                        })
                    }
                }

                diffs.push({
                    sha: commit.id,
                    name: commit.message,
                    fileDiffs: fileDiffs
                })
            } catch (error) {
                console.error(`Error fetching commit ${commit.id}:`, safeErrorFields(error))
            }
        }

        try {
            await VectraInterface.githubUnifiedEvent(context.payload.sender?.login, installationId, context.payload.repository.name, "push", {
                branch: context.payload.ref,
                commits: diffs,
                repository: {
                    id: Number(context.payload.repository.id),
                    name: context.payload.repository.name,
                    owner: context.payload.repository.owner.login,
                    defaultBranch: context.payload.repository.default_branch
                },
                sender: {
                    login: context.payload.sender?.login,
                    email: context.payload.sender?.email
                }
            })
        } catch (error) {
            console.error("Error calling githubUnifiedEvent:", safeErrorFields(error))
        }
    })

    app.on("pull_request.synchronize", async context => {
        const pr = context.payload.pull_request as any
        console.log("🔔 Pull request synchronized:", pr?.title)
        await handleUnifiedPullRequestEvent(context, "pull_request.synchronize")
    })

    app.on("pull_request.opened", async context => {
        const pr = context.payload.pull_request as any
        console.log("🔔 Pull request opened:", pr?.title)
        await handleUnifiedPullRequestEvent(context, "pull_request.opened")
    })

    app.on("pull_request.closed", async context => {
        const pr = context.payload.pull_request as any
        console.log("🔔 Pull request closed:", pr?.title)
        const eventType = pr?.merged ? "pull_request.merged" : "pull_request.closed"
        await handleUnifiedPullRequestEvent(context, eventType)
    })

    app.on("issue_comment.created", async context => {
        const { payload } = context
        const isPullRequest = Boolean(payload.issue.pull_request)
        console.log(`🔔 ${isPullRequest ? "PR" : "Issue"} comment created on #${payload.issue.number}`)
        await handleIssueCommentEvent(context, isPullRequest)
    })

    app.on("issue_comment.edited", async context => {
        const { payload } = context
        if (!payload.issue.pull_request) return
        console.log(`🔔 PR comment edited on #${payload.issue.number}`)
        await handlePRCommentEditedEvent(context)
    })

    async function handleUnifiedPullRequestEvent(context: any, eventType: string) {
        const { payload } = context
        const github = context.octokit
        const installationId = context.payload.installation?.id || 0

        let diffs: Commit[] = []

        // Get commits in the PR
        try {
            const { data: commits } = await github.rest.pulls.listCommits({
                owner: payload.repository.owner.login,
                repo: payload.repository.name,
                pull_number: payload.pull_request.number
            })

            // Get commit diffs
            for (const commit of commits) {
                try {
                    const { data: commitData } = await github.rest.repos.getCommit({
                        owner: payload.repository.owner.login,
                        repo: payload.repository.name,
                        ref: commit.sha
                    })

                    let fileDiffs: FileDiff[] = []
                    for (const file of commitData.files || []) {
                        if (file.patch) {
                            fileDiffs.push({
                                filename: file.filename,
                                diff: file.patch
                            })
                        }
                    }

                    diffs.push({
                        sha: commit.sha,
                        name: commit.commit.message,
                        fileDiffs: fileDiffs
                    })
                } catch (error) {
                    console.error(`Error fetching commit ${commit.sha}:`, safeErrorFields(error))
                }
            }

            await VectraInterface.githubUnifiedEvent(payload.sender?.login, installationId, payload.repository.name, eventType, {
                pullRequest: {
                    id: payload.pull_request.id,
                    number: payload.pull_request.number,
                    title: payload.pull_request.title,
                    body: payload.pull_request.body,
                    state: payload.pull_request.state,
                    merged: payload.pull_request.merged,
                    head: {
                        ref: payload.pull_request.head.ref,
                        sha: payload.pull_request.head.sha
                    },
                    base: {
                        ref: payload.pull_request.base.ref,
                        sha: payload.pull_request.base.sha
                    },
                    user: {
                        login: payload.pull_request.user.login,
                        email: payload.pull_request.user.email
                    }
                },
                commits: diffs,
                repository: {
                    id: Number(payload.repository.id),
                    name: payload.repository.name,
                    owner: payload.repository.owner.login,
                    defaultBranch: payload.repository.default_branch
                },
                sender: {
                    login: payload.sender?.login,
                    email: payload.sender?.email
                }
            })
        } catch (error) {
            console.error("Error handling unified pull request event:", safeErrorFields(error))
        }
    }

    async function handleIssueCommentEvent(context: any, isPullRequest: boolean) {
        const { payload } = context
        const installationId = payload.installation?.id || 0

        try {
            await VectraInterface.githubUnifiedEvent(payload.sender?.login, installationId, payload.repository.name, "issue_comment.created", {
                issue: {
                    id: payload.issue.id,
                    number: payload.issue.number,
                    title: payload.issue.title,
                    body: payload.issue.body,
                    state: payload.issue.state,
                    url: payload.issue.html_url,
                    author: {
                        login: payload.issue.user.login,
                        email: payload.issue.user.email
                    },
                    isPullRequest
                },
                comment: {
                    id: payload.comment.id,
                    body: payload.comment.body,
                    author: {
                        login: payload.comment.user.login,
                        email: payload.comment.user.email
                    },
                    url: payload.comment.html_url,
                    createdAt: payload.comment.created_at,
                    updatedAt: payload.comment.updated_at
                },
                repository: {
                    id: Number(payload.repository.id),
                    name: payload.repository.name,
                    owner: payload.repository.owner.login,
                    defaultBranch: payload.repository.default_branch
                },
                sender: {
                    login: payload.sender?.login,
                    email: payload.sender?.email
                }
            })
        } catch (error) {
            console.error("Error handling issue_comment event:", safeErrorFields(error))
        }
    }

    async function handlePRCommentEditedEvent(context: any) {
        const { payload } = context
        const installationId = payload.installation?.id || 0

        try {
            await VectraInterface.githubUnifiedEvent(payload.sender?.login, installationId, payload.repository.name, "pull_request.comment.edited", {
                issue: {
                    id: payload.issue.id,
                    number: payload.issue.number,
                    title: payload.issue.title,
                    body: payload.issue.body,
                    state: payload.issue.state,
                    url: payload.issue.html_url,
                    author: {
                        login: payload.issue.user.login,
                        email: payload.issue.user.email
                    },
                    isPullRequest: true
                },
                comment: {
                    id: payload.comment.id,
                    body: payload.comment.body,
                    author: {
                        login: payload.comment.user.login,
                        email: payload.comment.user.email
                    },
                    url: payload.comment.html_url,
                    createdAt: payload.comment.created_at,
                    updatedAt: payload.comment.updated_at
                },
                repository: {
                    id: Number(payload.repository.id),
                    name: payload.repository.name,
                    owner: payload.repository.owner.login,
                    defaultBranch: payload.repository.default_branch
                },
                sender: {
                    login: payload.sender?.login,
                    email: payload.sender?.email
                }
            })
        } catch (error) {
            console.error("Error handling pull request comment edited event:", safeErrorFields(error))
        }
    }

    app.on("installation.created", async context => {
        const email = context.payload.sender?.email || ""
        const name = context.payload.sender?.name || ""
        const login = context.payload.sender?.login
        const installationId = context.payload.installation.id

        // Get the account (user or org) where the app was installed
        const accountName = context.payload.installation.account?.login || null
        const repositories = context.payload.repositories.map(repo => ({
            name: repo.name,
            owner: repo.full_name,
            id: repo.id
        }))

        try {
            await VectraInterface.githubAppInstallationCallback(name, email, login, installationId, accountName, repositories)
        } catch (error) {
            console.error("Error calling githubAppInstallationCallback:", safeErrorFields(error))
        }
    })

    app.on("installation.deleted", async context => {
        console.log("🗑️ GitHub App installation deleted:", context.payload.sender?.login)

        const username = context.payload.sender?.login
        const installationId = context.payload.installation.id

        try {
            await VectraInterface.githubAppInstallationDeleted(username, installationId)
        } catch (error) {
            console.error("Error calling githubAppInstallationDeleted:", safeErrorFields(error))
        }
    })
}

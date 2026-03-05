import { Octokit } from "@octokit/rest"
import type { RestEndpointMethodTypes } from "@octokit/rest"
import { InputConfigType } from "@prisma/client"
import axios, { AxiosResponse } from "axios"
import * as cheerio from "cheerio"
import { Request, Response } from "express"

import { EventProcessor } from "../agent/AgentRunner/EventProcessor"
import { githubApp, urls } from "../config/settings"
import logger, { runWithUserContext } from "../logger"
import { db } from "../prismaClient"
import { Identifiable } from "../rag/Hydrator"
import {
    GithubAppInstallation,
    GithubAppInstallationRepository,
    GithubAppInstallationRepositoryResponse,
    GithubAppInstallationResponse,
    GithubAppUnifiedEventRequest,
    GithubAppUser
} from "../routes/GithubTypes"
import { fetchGithubRepositoriesForIntegration } from "../routes/github"
import { FileDownloadResult, StoredFile, buildGithubFileKey, ensureStoredWithMetadata } from "../services/FileStorageService"
import { ConfigInstance, ConfigType, GitHubConfig as GitHubConfigClass, GitHubEventType } from "../shared/Configs"
import { FrontendRoutes } from "../shared/FrontendRoutes"
import { AdditionalStateParams, GithubIntegration, GithubIntegrationMetadata, InstallationOptionsFor, IntegrationType } from "../shared/Integrations"
import { RunHistoryTrigger } from "../shared/RunHistoryTypes"
import { OAuthInstallationDetails, Repository } from "../shared/types"
import { AgentTriggerWithConfigs, User as PrismaUser } from "../types/prisma"
import { HydratorType } from "../types/rag"
import { OAuthStateEncodingFormat, createOAuthStateToken, decodeOAuthStateToken } from "../utility/oauth"
import { getUserForOrg } from "../utility/workos"

import { IntegrationCompletedTask } from "./IntegrationCompletedTask"
import { integrationTaskQueue } from "./IntegrationTaskQueues"
import { FetchResourcesOptions } from "./abstract/FetchResourcesOptions"
import { InputEvent } from "./abstract/InputEvent"
import { ConfigurationFieldDefinition, Integration, IntegrationWithResources, OAuthIntegrationInstallation } from "./abstract/Integration"

export class GithubIntegrationManager
    implements Integration<GithubIntegration, GithubAppUnifiedEventRequest, typeof GithubIntegrationMetadata, Repository>, OAuthIntegrationInstallation<IntegrationType.GITHUB>
{
    constructor() {}
    integrationType: IntegrationType = IntegrationType.GITHUB

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<GithubIntegration[]> {
        const organizationAccounts = await db().github_app_tokens.findMany({
            where: { organization_id: organizationId }
        })
        const installations = await Promise.all(
            organizationAccounts.map(async oa => {
                const appInstallations = await getAppInstallationsForUser(oa.access_token)
                return appInstallations.installations.map(ai => ({
                    id: ai.id.toString(),
                    installation_id: ai.id,
                    account_name: ai.account.login
                }))
            })
        )
        return installations.flat()
    }

    async fetchResourcesForOrganization(organizationId: string, query?: string, _options?: FetchResourcesOptions): Promise<IntegrationWithResources<GithubIntegration, Repository>[]> {
        const integrations = await this.getInstancesForOrganization(organizationId)
        const normalizedQuery = query?.trim().toLowerCase()
        const matchesQuery = (value: string | undefined | null): boolean => {
            if (!normalizedQuery) return true
            if (!value) return false
            return value.toLowerCase().includes(normalizedQuery)
        }
        return Promise.all(
            integrations.map(async integration => {
                const installationId = integration.installation_id ?? Number(integration.id)
                if (!installationId) {
                    return { integration, resources: [] }
                }
                try {
                    const response = await fetchGithubRepositoriesForIntegration(organizationId, String(installationId))
                    const repositories = normalizedQuery ? response.repositories.filter(repo => matchesQuery(`${repo.owner}/${repo.name}`) || matchesQuery(repo.name)) : response.repositories
                    return { integration, resources: repositories }
                } catch (error) {
                    logger.warn(`Failed to fetch resources for GitHub integration ${integration.id}`, { error, integrationId: integration.id })
                    return { integration, resources: [] }
                }
            })
        )
    }

    formatIntegrationInstanceForAgent(instance: GithubIntegration): string {
        const details: string[] = []
        if (instance.account_name) {
            details.push(`account "${instance.account_name}"`)
        }
        if (instance.installation_id) {
            details.push(`installationId ${instance.installation_id}`)
        }
        const detailText = details.length ? ` (${details.join(", ")})` : ""
        return `Github${detailText} [id: ${instance.id}]`
    }

    async getAllActiveInstances(): Promise<GithubIntegration[]> {
        const userGithubInstallations = await db().user_github_installation.findMany({
            select: {
                id: true,
                installation_id: true,
                account_name: true
            }
        })
        return userGithubInstallations.map(ugi => ({
            id: ugi.id,
            installation_id: ugi.installation_id,
            account_name: ugi.account_name || null
        }))
    }

    async processWebhookEvent(event: GithubAppUnifiedEventRequest): Promise<void> {
        const users: PrismaUser[] = await resolveUsersForGithubInstallation(event.installationId)

        if (users.length === 0) {
            logger.warn(`⚠️  No users found for GitHub event from ${event.installationId}`, { installationId: event.installationId, eventType: event.eventType })
            return
        }

        for (const user of users) {
            const token = await db().github_app_tokens.findFirst({
                where: { user_id: user.id },
                select: { organization_id: true, access_token: true }
            })
            if (!token?.organization_id) continue
            const fullUser = await getUserForOrg(user.id, token.organization_id)
            if (!fullUser) continue

            // Attach any images or files from the event
            const storedFiles: StoredFile[] = await getPullRequestFiles(event, token.access_token, event.installationId.toString())
            await runWithUserContext(fullUser, async () => {
                const githubEvent = new GithubEvent(event, storedFiles)
                const eventProcessor = new EventProcessor(githubEvent, fullUser)
                await eventProcessor.process()
            })
        }
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options?: InstallationOptionsFor<IntegrationType.GITHUB>,
        additionalStatePayload?: AdditionalStateParams
    ): Promise<OAuthInstallationDetails> {
        const appName = githubApp.appName
        const clientId = githubApp.clientId
        const redirectUri = githubApp.integrateCallbackUrl

        // Generate state token using helper function (handles merging and encoding)
        const state = createOAuthStateToken({
            userId,
            organizationId,
            additionalStatePayload,
            encodingFormat: OAuthStateEncodingFormat.BASE64
        })

        const installationUrl: string = `https://github.com/apps/${appName}/installations/new?client_id=${clientId}&redirect_uri=${encodeURIComponent(
            redirectUri
        )}&target_type=repositories&state=${state}`

        return {
            oauthUrl: installationUrl
        }
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { installation_id, setup_action, state, code } = req.query as {
            installation_id: string
            setup_action: string
            state: string
            code: string
        }

        logger.info("[GitHub Setup URL Installation]", {
            installationId: installation_id,
            setupAction: setup_action,
            hasState: !!state
        })

        try {
            // Decode state using helper function (can throw)
            const stateData = decodeOAuthStateToken(state as string)
            const user_id = stateData.userId
            const organizationId = stateData.organizationId

            if (!user_id || typeof user_id !== "string") {
                logger.error("[GitHub Setup URL Installation] ERROR: userId is required in state", { installationId: installation_id })
                res.status(400).json({ message: "Invalid state. Please try again from the app." })
                return
            }

            if (!organizationId || typeof organizationId !== "string") {
                logger.error("[GitHub Setup URL Installation] ERROR: organizationId is required in state", { userId: user_id, installationId: installation_id })
                res.status(400).json({
                    message: "Organization context required. Please try again from the app."
                })
                return
            }

            const user: PrismaUser | null = await db().users.findUnique({
                where: { id: user_id }
            })

            if (!user) {
                logger.error("[GitHub Setup URL Installation] ERROR: User not found", {
                    userId: user_id,
                    installationId: installation_id
                })
                res.status(400).json({ message: "User not found" })
                return
            }

            // parse installation_id as number
            const installation_id_number = parseInt(installation_id as string)
            if (isNaN(installation_id_number)) {
                logger.error("[GitHub Setup URL Installation] ERROR: Installation ID is not a number", { installationId: installation_id, userId: user_id })
                res.status(400).json({ message: "Installation ID is not a number" })
                return
            }

            const authToken = await exchangeCodeForAccessToken(code)
            const githubAppUser = await getGithubAppUser(authToken.access_token)

            const githubInstallation = await db().$transaction(async prisma => {
                const installation = await prisma.user_github_installation.upsert({
                    where: { installation_id: installation_id_number },
                    update: { user_id: user_id },
                    create: { user_id: user_id, installation_id: installation_id_number }
                })

                await prisma.github_app_tokens.upsert({
                    where: {
                        user_id_github_username: {
                            user_id: user_id,
                            github_username: githubAppUser.login
                        }
                    },
                    update: {
                        access_token: authToken.access_token,
                        organization_id: organizationId
                    },
                    create: {
                        user_id: user_id,
                        github_username: githubAppUser.login,
                        access_token: authToken.access_token,
                        organization_id: organizationId
                    }
                })

                return installation
            })

            logger.info("[GitHub Setup URL Installation] Upsert completed", {
                installationId: installation_id_number,
                userId: user_id
            })

            // Emit integration completed task (includes full state payload for chat metadata detection)
            // Note: GitHub uses base64-encoded JSON state, so we decode it and pass as statePayload
            integrationTaskQueue.emit(
                new IntegrationCompletedTask(
                    IntegrationType.GITHUB,
                    githubInstallation.installation_id.toString(), // Use GitHub installation_id (not DB CUID) to match getInstancesForOrganization()
                    user_id,
                    stateData,
                    new Date()
                )
            )

            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("[GitHub Setup URL Installation] Callback error", {
                error,
                installationId: installation_id
            })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve()
    }

    async setupAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // GitHub doesn't require any setup for channel inputs
        // Webhooks are managed at the integration level
    }

    async teardownAgentTrigger(integrationId: string, agentTrigger: AgentTriggerWithConfigs): Promise<void> {
        // GitHub doesn't require any teardown for channel inputs
        // Webhooks are managed at the integration level
    }

    async refreshToken(integrationId: string): Promise<boolean> {
        // GitHub uses installation-based authentication that doesn't use traditional OAuth refresh tokens
        // Tokens are generated on-demand from the installation
        // Return false to indicate no refresh was needed/performed
        return false
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        // GitHub App uses installation-based authentication, not traditional OAuth tokens
        // Tokens are generated on-demand using JWT and the installation ID
        // This method returns null because we don't store access tokens in the database
        // Token generation happens elsewhere when making API calls (typically using GitHub App's private key)
        try {
            const installation = await db().user_github_installation.findUnique({
                where: { id: integrationId }
            })

            if (!installation) {
                logger.error(`GitHub installation ${integrationId} not found`, {
                    integrationId
                })
                return null
            }

            // GitHub App installations don't store access tokens
            // They generate tokens on-demand using the installation ID and App credentials
            // Return null to indicate tokens must be generated via GitHub App flow
            return null
        } catch (error) {
            logger.error(`Error getting GitHub access token for installation ${integrationId}`, { error, integrationId })
            return null
        }
    }

    async getSampleEvents(integrationId: string, organizationId: string, triggerConfig: ConfigInstance, options?: { limit?: number }): Promise<InputEvent[]> {
        if (triggerConfig.configType !== ConfigType.GITHUB) {
            return []
        }
        const githubConfig = triggerConfig as GitHubConfigClass

        const maxEvents = Math.min(options?.limit ?? 6, 10)

        const installations = await this.getInstancesForOrganization(organizationId)
        const installation = installations.find(i => i.id === integrationId)
        if (!installation) {
            throw new Error(`GitHub integration ${integrationId} not found`)
        }

        const installationIdNum = installation.installation_id
        const users = await resolveUsersForGithubInstallation(installationIdNum)
        if (users.length === 0) {
            throw new Error("No users found with access to this GitHub installation")
        }

        const tokenRow = await db().github_app_tokens.findFirst({
            where: { user_id: users[0].id }
        })
        if (!tokenRow?.access_token) {
            throw new Error("No GitHub token found for user. Please connect your GitHub account.")
        }

        const accessToken = tokenRow.access_token
        const userInstallations = await getAppInstallationsForUser(accessToken)
        if (!userInstallations.installations.some(inst => inst.id === installationIdNum)) {
            throw new Error("Installation not found or access denied.")
        }

        let repos: Array<{ id: number; owner: string; name: string; defaultBranch: string }> = []

        if (githubConfig.repositoryIds?.length) {
            for (const repoId of githubConfig.repositoryIds.slice(0, 2)) {
                const repo = await fetchRepositoryDetailsForSample(accessToken, repoId)
                if (repo) repos.push(repo)
            }
        } else {
            const installationRepos = await getAppInstallationRepositories(accessToken, installationIdNum)
            repos = installationRepos.slice(0, 2).map(r => ({
                id: r.id,
                owner: r.owner.login,
                name: r.name,
                defaultBranch: r.default_branch || "main"
            }))
        }

        const events: InputEvent[] = []
        for (const repo of repos) {
            const commits = await fetchRecentCommitsForSample(accessToken, repo.owner, repo.name, 5)
            for (const commit of commits) {
                const eventData = await createPushEventData(commit, repo, installationIdNum, accessToken)
                if (eventData) events.push(new GithubEvent(eventData, []))
            }
            const pullRequests = await fetchRecentPullRequestsForSample(accessToken, repo.owner, repo.name, 5)
            for (const pr of pullRequests) {
                const eventData = await createPullRequestEventData(pr, repo, installationIdNum, accessToken)
                let storedFiles: StoredFile[] = []
                if (eventData) storedFiles = await getPullRequestFiles(eventData, accessToken, installationIdNum.toString())
                if (eventData) events.push(new GithubEvent(eventData, storedFiles))
            }
            if (events.length >= maxEvents) break
        }
        return events.slice(0, maxEvents)
    }
}

// MARK: - GithubEvent

export class GithubEvent extends InputEvent implements Identifiable {
    readonly integrationType: IntegrationType = IntegrationType.GITHUB
    readonly eventType: GitHubEventType
    entityType = HydratorType.GITHUB_EVENT
    entityId: string
    data: GithubAppUnifiedEventRequest
    private storedFiles: StoredFile[]

    constructor(data: GithubAppUnifiedEventRequest, storedFiles: StoredFile[] = []) {
        super()
        this.data = data
        this.storedFiles = storedFiles
        this.eventType = data.eventType as GitHubEventType
        if (data.pullRequest) {
            this.entityId = `${data.installationId}:${data.repository.id}:pr/${data.pullRequest.number}`
        } else if (data.commits?.length) {
            this.entityId = `${data.installationId}:${data.repository.id}:commit/${data.commits[0].sha}`
        } else {
            this.entityId = `${data.installationId}:${data.repository.id}:push/${data.branch ?? "main"}`
        }
    }

    formatForAgentRunner(): string {
        const indentMultiline = (text: string): string =>
            text
                .split("\n")
                .map(line => `        ${line}`)
                .join("\n")

        // Event type description
        const eventTypeDescriptions: Record<string, string> = {
            push: "Code Push Event",
            "pull_request.opened": "Pull Request Opened",
            "pull_request.synchronize": "Pull Request Updated (new commits added)",
            "pull_request.closed": "Pull Request Closed",
            "pull_request.merged": "Pull Request Merged"
        }
        const eventDescription = eventTypeDescriptions[this.data.eventType] || this.data.eventType

        // Repository information
        const repoInfo = [
            `Repository: ${this.data.repository.owner}/${this.data.repository.name}`,
            `Repository ID: ${this.data.repository.id}`,
            `Default Branch: ${this.data.repository.defaultBranch}`,
            `View on GitHub: https://github.com/${this.data.repository.owner}/${this.data.repository.name}`
        ].join("\n")

        // Sender/Actor information
        const senderInfo = [`Actor: ${this.data.sender.login}`, ...(this.data.sender.email ? [`Email: ${this.data.sender.email}`] : [])].join("\n")

        // Branch information (for push events)
        const branchInfo = this.data.branch ? `Branch: ${this.data.branch}` : null

        // Pull Request information (for PR events)
        let prInfo = ""
        if (this.data.pullRequest) {
            const pr = this.data.pullRequest
            const prLines = [
                `Pull Request #${pr.number}: ${pr.title}`,
                `State: ${pr.state}${pr.merged ? " (merged)" : ""}`,
                `Author: ${pr.user.login}${pr.user.email ? ` (${pr.user.email})` : ""}`,
                `Head Branch: ${pr.head.ref} (${pr.head.sha.substring(0, 7)})`,
                `Base Branch: ${pr.base.ref} (${pr.base.sha.substring(0, 7)})`,
                `View PR: https://github.com/${this.data.repository.owner}/${this.data.repository.name}/pull/${pr.number}`
            ]
            if (pr.body) {
                prLines.push(`\nDescription:\n${indentMultiline(pr.body)}`)
            }
            prInfo = prLines.join("\n")
        }

        // Commits information
        let commitsInfo = ""
        if (this.data.commits && this.data.commits.length > 0) {
            const commitLines: string[] = []
            commitLines.push(`Commits (${this.data.commits.length}):`)

            this.data.commits.forEach((commit, index) => {
                const shortSha = commit.sha.substring(0, 7)
                const commitUrl = `https://github.com/${this.data.repository.owner}/${this.data.repository.name}/commit/${commit.sha}`

                commitLines.push(`\n${index + 1}. Commit ${shortSha}: ${commit.name}`)
                commitLines.push(`   URL: ${commitUrl}`)

                if (commit.fileDiffs && commit.fileDiffs.length > 0) {
                    commitLines.push(`   Files Changed: ${commit.fileDiffs.length}`)

                    // List files changed
                    const fileList = commit.fileDiffs.map(f => `     - ${f.filename}`).join("\n")
                    commitLines.push(`   Files:\n${fileList}`)

                    // Show diffs for important files (limit to first 3 files to avoid overwhelming)
                    const filesToShow = commit.fileDiffs.slice(0, 3)
                    filesToShow.forEach(file => {
                        if (file.diff) {
                            // Truncate very long diffs
                            const maxDiffLines = 50
                            const diffLines = file.diff.split("\n")
                            const truncatedDiff =
                                diffLines.length > maxDiffLines ? diffLines.slice(0, maxDiffLines).join("\n") + `\n     ... (${diffLines.length - maxDiffLines} more lines)` : file.diff

                            commitLines.push(`\n   Diff for ${file.filename}:`)
                            commitLines.push(indentMultiline(truncatedDiff))
                        }
                    })

                    if (commit.fileDiffs.length > 3) {
                        commitLines.push(`\n   ... and ${commit.fileDiffs.length - 3} more file(s) changed`)
                    }
                }
            })

            commitsInfo = commitLines.join("\n")
        }

        // Stored image URLs for images that appeared in the PR description.
        // The original GitHub asset URLs (github.com/user-attachments/...) require authentication
        // and will not render in email clients or other external contexts.
        let attachedImagesInfo: string | null = null
        if (this.storedFiles.length > 0) {
            const lines = this.storedFiles.map(f => `- ${f.filename || "image"} (${f.mimeType}): ${f.url}`)
            attachedImagesInfo = `Attached Images (publicly accessible replacements for the GitHub image URLs in the PR description — use these, not the original github.com URLs):\n${lines.join("\n")}`
        }

        // Build the formatted output
        const sections = [
            `Incoming GitHub Event: ${eventDescription}`,
            `\nRepository Information:\n${indentMultiline(repoInfo)}`,
            `\nActor Information:\n${indentMultiline(senderInfo)}`,
            ...(branchInfo ? [`\nBranch Information:\n${indentMultiline(branchInfo)}`] : []),
            ...(prInfo ? [`\nPull Request Information:\n${indentMultiline(prInfo)}`] : []),
            ...(commitsInfo ? [`\n${commitsInfo}`] : []),
            ...(attachedImagesInfo ? [`\n${attachedImagesInfo}`] : [])
        ].filter(Boolean)

        const resp = sections.join("\n\n") + "\n"
        return resp
    }

    debugLog(): string {
        return `GitHub Event: ${this.data.eventType} - ${this.data.repositoryName} - ${this.data.username}`
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.GITHUB) {
            return false
        }
        const githubConfig = agentTrigger.github_config

        // Make sure the repository is in the list of repositories configured for the channel
        if (!githubConfig?.repository_ids.includes(this.data.repository.id)) {
            logger.debug("GithubEvent matchesAgentTrigger - repository not found in channel", {
                repositoryId: this.data.repository.id,
                repositoryIds: githubConfig?.repository_ids,
                agentTriggerId: agentTrigger.id
            })
            return false
        }

        return true
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: "github_event",
            integration: IntegrationType.GITHUB,
            source: this.data.repositoryName,
            title: this.data.eventType,
            subheader: this.data.username,
            url: `https://github.com/${this.data.repositoryName}/`
        }
    }

    getFiles(): StoredFile[] {
        return this.storedFiles
    }
}

// MARK: - Helper Functions - GITHUB REST API
export async function getGithubAppUser(githubAppAccessToken: string): Promise<GithubAppUser> {
    const resp = await axios.get("https://api.github.com/user", {
        headers: {
            Authorization: `Bearer ${githubAppAccessToken}`,
            Accept: "application/vnd.github+json"
        }
    })

    logger.debug("Github App user retrieved", {
        userId: resp.data.id,
        login: resp.data.login
    })
    return resp.data
}

export async function exchangeCodeForAccessToken(
    code: string,
    redirectUri?: string
): Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
}> {
    const tokenResp = await axios.post(
        "https://github.com/login/oauth/access_token",
        {
            client_id: githubApp.clientId,
            client_secret: githubApp.clientSecret,
            code,
            ...(redirectUri && { redirect_uri: redirectUri })
        },
        {
            headers: { Accept: "application/json" }
        }
    )

    const accessToken = tokenResp.data.access_token
    const refreshToken = tokenResp.data.refresh_token
    const expiresIn = tokenResp.data.expires_in
    return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn
    }
}

export async function getAppInstallationsForUser(oAuthToken: string): Promise<GithubAppInstallationResponse> {
    try {
        const allInstallations: GithubAppInstallation[] = []
        let page = 1
        const perPage = 100 // Max allowed by GitHub API

        while (true) {
            const resp: AxiosResponse<GithubAppInstallationResponse> = await axios.get("https://api.github.com/user/installations", {
                headers: {
                    Authorization: `Bearer ${oAuthToken}`,
                    Accept: "application/vnd.github+json"
                },
                params: {
                    per_page: perPage,
                    page
                }
            })

            allInstallations.push(...resp.data.installations)

            // If we got fewer than perPage, we've reached the last page
            if (resp.data.installations.length < perPage) {
                break
            }

            page++
        }

        return {
            total_count: allInstallations.length,
            installations: allInstallations
        }
    } catch (error) {
        logger.error("Error getting app installations for user", { error })
        return { total_count: 0, installations: [] }
    }
}

export async function getAppInstallationRepositories(oAuthToken: string, installationId: number): Promise<GithubAppInstallationRepository[]> {
    const allRepositories: GithubAppInstallationRepository[] = []
    let page = 1
    const perPage = 100 // Max allowed by GitHub API

    while (true) {
        const resp: AxiosResponse<GithubAppInstallationRepositoryResponse> = await axios.get(`https://api.github.com/user/installations/${installationId}/repositories`, {
            headers: {
                Authorization: `Bearer ${oAuthToken}`,
                Accept: "application/vnd.github+json"
            },
            params: {
                per_page: perPage,
                page
            }
        })

        allRepositories.push(...resp.data.repositories)

        // If we got fewer than perPage, we've reached the last page
        if (resp.data.repositories.length < perPage) {
            break
        }

        page++
    }

    return allRepositories
}

// Given an installation, we need to fetch all users that are associated with that installation.
export async function resolveUsersForGithubInstallation(installationId: number): Promise<PrismaUser[]> {
    return db().$transaction(async tx => {
        const githubAppUsers = await tx.github_app_tokens.findMany()
        const installationResults = await Promise.all(
            githubAppUsers.map(async user => {
                const installations = await getAppInstallationsForUser(user.access_token)
                return {
                    userId: user.user_id,
                    installations: installations.installations
                }
            })
        )
        const userIds = installationResults.filter(result => result.installations.some(inst => inst.id === installationId)).map(result => result.userId)
        const users = await tx.users.findMany({
            where: { id: { in: userIds } }
        })
        logger.debug(`Found ${users.length} users for event from installation`, {
            installationId,
            userCount: users.length
        })
        return users
    })
}

export type ValidateGithubRepositoryIdsOptions = {
    userId: string
    integrationId: string
    repositoryIds: number[]
    configTypeLabel: string
    contextLabel: string
}

/**
 * Verifies that the given GitHub repository IDs exist and are accessible for the integration (installation).
 */
export async function validateGithubRepositoryIds({ userId, integrationId, repositoryIds, configTypeLabel, contextLabel }: ValidateGithubRepositoryIdsOptions): Promise<void> {
    if (!Array.isArray(repositoryIds) || repositoryIds.length === 0) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: requires at least one repository`)
    }

    if (!userId) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: userId is required for validation`)
    }

    const accessToken = await db().github_app_tokens.findFirst({
        where: { user_id: userId },
        select: { access_token: true }
    })

    if (!accessToken?.access_token) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: no GitHub access token found for user`)
    }

    const installations = await getAppInstallationsForUser(accessToken.access_token)
    const integrationInstallationId = Number(integrationId)
    const targetInstallation = installations.installations.find(installation => (!Number.isNaN(integrationInstallationId) ? installation.id === integrationInstallationId : false))

    if (!targetInstallation) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: installation not found`)
    }

    const repositories = await getAppInstallationRepositories(accessToken.access_token, targetInstallation.id)

    const foundIds = new Set(repositories.map(repo => repo.id))
    const missingIds = repositoryIds.filter(id => !foundIds.has(id))
    if (missingIds.length > 0) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: repositories not found (${missingIds.join(", ")})`)
    }
}

// MARK: - Sample events helpers

type OctokitCommit = RestEndpointMethodTypes["repos"]["listCommits"]["response"]["data"][number]
type OctokitCommitDetail = RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"]
type OctokitPullRequest = RestEndpointMethodTypes["pulls"]["list"]["response"]["data"][number]
type OctokitPullRequestCommit = RestEndpointMethodTypes["pulls"]["listCommits"]["response"]["data"][number]

function createOctokitForSample(accessToken: string): Octokit {
    return new Octokit({ auth: accessToken })
}

async function fetchRepositoryDetailsForSample(accessToken: string, repoId: number): Promise<{ id: number; owner: string; name: string; defaultBranch: string } | null> {
    try {
        const response = await axios.get(`https://api.github.com/repositories/${repoId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/vnd.github+json"
            }
        })
        return {
            id: response.data.id,
            owner: response.data.owner.login,
            name: response.data.name,
            defaultBranch: response.data.default_branch || "main"
        }
    } catch (error) {
        logger.error("Error fetching repository details for sample", { error, repoId })
        return null
    }
}

async function fetchRecentCommitsForSample(accessToken: string, owner: string, repo: string, count: number): Promise<OctokitCommit[]> {
    try {
        const octokit = createOctokitForSample(accessToken)
        const response = await octokit.rest.repos.listCommits({
            owner,
            repo,
            per_page: count
        })
        return response.data
    } catch (error) {
        logger.error("Error fetching recent commits for sample", { error, owner, repo })
        return []
    }
}

async function fetchCommitDiffForSample(accessToken: string, owner: string, repo: string, sha: string): Promise<OctokitCommitDetail | null> {
    try {
        const octokit = createOctokitForSample(accessToken)
        const response = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: sha
        })
        return response.data
    } catch (error) {
        logger.error("Error fetching commit diff for sample", { error, owner, repo, sha })
        return null
    }
}

async function fetchRecentPullRequestsForSample(accessToken: string, owner: string, repo: string, count: number): Promise<OctokitPullRequest[]> {
    try {
        const octokit = createOctokitForSample(accessToken)
        const response = await octokit.rest.pulls.list({
            owner,
            repo,
            state: "all",
            sort: "updated",
            direction: "desc",
            per_page: count
        })
        return response.data
    } catch (error) {
        logger.error("Error fetching recent pull requests for sample", { error, owner, repo })
        return []
    }
}

async function fetchPullRequestCommitsForSample(accessToken: string, owner: string, repo: string, prNumber: number): Promise<OctokitPullRequestCommit[]> {
    try {
        const octokit = createOctokitForSample(accessToken)
        const response = await octokit.rest.pulls.listCommits({
            owner,
            repo,
            pull_number: prNumber
        })
        return response.data
    } catch (error) {
        logger.error("Error fetching PR commits for sample", { error, owner, repo, prNumber })
        return []
    }
}

async function createPushEventData(
    commit: OctokitCommit,
    repo: { id: number; owner: string; name: string; defaultBranch: string },
    installationId: number,
    accessToken: string
): Promise<GithubAppUnifiedEventRequest | null> {
    try {
        const commitDetails = await fetchCommitDiffForSample(accessToken, repo.owner, repo.name, commit.sha)
        if (!commitDetails) return null

        const fileDiffs = (commitDetails.files || []).map(file => ({
            filename: file.filename!,
            diff: file.patch || ""
        }))

        return {
            username: commit.commit.author?.name || commit.author?.login || "unknown",
            installationId,
            repositoryName: `${repo.owner}/${repo.name}`,
            eventType: "push",
            branch: repo.defaultBranch,
            commits: [
                {
                    sha: commit.sha,
                    name: commit.commit.message,
                    fileDiffs
                }
            ],
            repository: {
                id: repo.id,
                name: repo.name,
                owner: repo.owner,
                defaultBranch: repo.defaultBranch
            },
            sender: {
                login: commit.commit.author?.name || commit.author?.login || "unknown",
                email: commit.commit.author?.email
            }
        }
    } catch (error) {
        logger.error("Error creating push event data for sample", { error, commit: commit.sha })
        return null
    }
}

async function createPullRequestEventData(
    pr: OctokitPullRequest,
    repo: { id: number; owner: string; name: string; defaultBranch: string },
    installationId: number,
    accessToken: string
): Promise<GithubAppUnifiedEventRequest | null> {
    try {
        let eventType: "pull_request.opened" | "pull_request.merged" | "pull_request.closed" = pr.merged_at
            ? "pull_request.merged"
            : pr.state === "closed"
              ? "pull_request.closed"
              : "pull_request.opened"

        const prCommits = await fetchPullRequestCommitsForSample(accessToken, repo.owner, repo.name, pr.number)
        const commits = await Promise.all(
            prCommits.slice(0, 3).map(async commit => {
                const commitDetails = await fetchCommitDiffForSample(accessToken, repo.owner, repo.name, commit.sha)
                const fileDiffs = (commitDetails?.files || []).map(file => ({
                    filename: file.filename!,
                    diff: file.patch || ""
                }))
                return {
                    sha: commit.sha,
                    name: commit.commit.message,
                    fileDiffs
                }
            })
        )

        return {
            username: pr.user?.login || "unknown",
            installationId,
            repositoryName: `${repo.owner}/${repo.name}`,
            eventType,
            commits,
            pullRequest: {
                id: String(pr.id),
                number: pr.number,
                title: pr.title ?? "",
                body: pr.body ?? undefined,
                state: pr.state as "open" | "closed",
                merged: pr.merged_at !== null,
                head: { ref: pr.head.ref, sha: pr.head.sha },
                base: { ref: pr.base.ref, sha: pr.base.sha },
                user: { login: pr.user?.login || "unknown", email: undefined }
            },
            repository: {
                id: repo.id,
                name: repo.name,
                owner: repo.owner,
                defaultBranch: repo.defaultBranch
            },
            sender: {
                login: pr.user?.login || "unknown",
                email: undefined
            }
        }
    } catch (error) {
        logger.error("Error creating pull request event data for sample", { error, pr: pr.number })
        return null
    }
}

export async function getPullRequestFiles(event: GithubAppUnifiedEventRequest, token: string, integrationId: string): Promise<StoredFile[]> {
    if (!event.pullRequest) {
        return []
    }

    const [owner, repo] = event.repositoryName.split("/")
    if (!owner || !repo) {
        return []
    }

    const prNumber = event.pullRequest.number
    let bodyHtml: string | null = null
    try {
        const octokit = new Octokit({ auth: token })
        const response = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
            owner,
            repo,
            pull_number: prNumber,
            headers: { accept: "application/vnd.github.html+json" }
        })
        bodyHtml = (response.data as any).body_html ?? null
    } catch (error) {
        logger.error("Error fetching rendered PR body from GitHub API", { error, prNumber, repositoryName: event.repositoryName })
        return []
    }

    if (!bodyHtml) {
        return []
    }

    const imageUrls = getImageUrlsFromHtml(bodyHtml)
    if (imageUrls.length === 0) {
        return []
    }

    const fileResults = await Promise.allSettled(imageUrls.map(url => processGithubFile(url, token, integrationId)))
    return fileResults.flatMap((result, index) => {
        if (result.status === "fulfilled") {
            return result.value ? [result.value] : []
        }

        logger.warn("Skipping PR image URL after upload/download failure", {
            url: imageUrls[index],
            integrationId,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        })
        return []
    })
}

function getImageUrlsFromHtml(html: string): string[] {
    const $ = cheerio.load(html)
    return $("img")
        .map((_, img) => $(img).attr("src"))
        .get()
        .filter((src): src is string => Boolean(src))
}

type GithubFile = {
    filename: string
    contentType: string
    data: Buffer
}

async function processGithubFile(url: string, token: string, integrationId: string): Promise<StoredFile | null> {
    try {
        const primaryKey = buildGithubFileKey(integrationId, url)
        const storedFile = await ensureStoredWithMetadata(primaryKey, async (): Promise<FileDownloadResult> => {
            const resp = await downloadGithubFile(url, token)
            if (!resp) {
                throw new Error(`Failed to download file from GitHub URL: ${url}`)
            }
            const { filename, contentType, data } = resp
            return {
                data: data,
                mimeType: contentType || "application/octet-stream",
                filename: filename
            }
        })

        if (storedFile) {
            logger.debug(`✅ Stored Github attachment in GCS`, {
                url,
                integrationId,
                filename: storedFile.filename,
                mimeType: storedFile.mimeType,
                sizeBytes: storedFile.sizeBytes
            })
        }
        return storedFile ?? null
    } catch (error) {
        logger.warn("Skipping GitHub PR image URL that could not be uploaded", {
            error,
            url,
            integrationId
        })
        return null
    }
}

/** Allowed hostnames for GitHub asset URLs. Prevents token leakage to attacker-controlled servers. */
const GITHUB_ASSET_HOSTS = new Set([
    "github.com",
    "user-images.githubusercontent.com",
    "private-user-images.githubusercontent.com",
    "github.githubassets.com",
    "raw.githubusercontent.com",
    "camo.githubusercontent.com",
    "avatars.githubusercontent.com",
    "media.githubusercontent.com"
])

class NonGithubUrlError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "NonGithubUrlError"
    }
}

function assertIsGithubAssetUrl(url: string): void {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        throw new NonGithubUrlError(`Invalid URL for GitHub asset: ${url}`)
    }
    if (parsed.protocol !== "https:") {
        throw new NonGithubUrlError(`Non-HTTPS URL rejected (would not send token): ${url}`)
    }
    const host = parsed.hostname.toLowerCase()
    if (!GITHUB_ASSET_HOSTS.has(host) && !host.endsWith(".githubusercontent.com") && !host.endsWith(".githubassets.com")) {
        throw new NonGithubUrlError(`Refusing to send GitHub token to non-GitHub URL: ${url}`)
    }
}

async function downloadGithubFile(url: string, token: string): Promise<GithubFile | null> {
    assertIsGithubAssetUrl(url)
    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            },
            responseType: "arraybuffer"
        })
        const contentType = response.headers["content-type"] || "application/octet-stream"
        const filename = url.split("/").pop() || "file"
        return {
            filename,
            contentType,
            data: response.data
        }
    } catch (error) {
        logger.error("Error downloading GitHub file", { error, url })
        return null
    }
}

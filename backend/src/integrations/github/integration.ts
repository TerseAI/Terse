import { Octokit } from "@octokit/rest"
import type { RestEndpointMethodTypes } from "@octokit/rest"
import { InputConfigType } from "@prisma/client"
import axios, { AxiosResponse } from "axios"
import * as cheerio from "cheerio"
import { Request, Response } from "express"
import { GithubTrigger } from "terse-types"
import { ConfigurationFieldDefinition } from "terse-types"
import { ConfigData, ConfigType, GitHubConfigSchema, GitHubEventType } from "terse-types/Configs"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import { AdditionalStateParams, GithubIntegration, GithubIntegrationMetadata, InstallationOptionsFor, IntegrationType } from "terse-types/Integrations"
import { RunHistoryTrigger } from "terse-types/RunHistoryTypes"
import { OAuthInstallationDetails, Repository } from "terse-types/types"
import { z } from "zod"

import logger, { runWithUserContext } from "../../common/logger"
import { Identifiable } from "../../hydrators/Hydrator"
import { db } from "../../loaders/prisma"
import { EventProcessor } from "../../modules/agents/AgentRunner/EventProcessor"
import { mintOAuthState, verifyOAuthState } from "../../modules/auth/helpers/oauth"
import { fetchGithubRepositoriesForIntegration } from "../../modules/integrations/github/controller"
import { GithubAppInstallation, GithubAppInstallationRepository, GithubAppInstallationRepositoryResponse, GithubAppInstallationResponse, GithubAppUser } from "../../modules/integrations/github/types"
import { getGitHubAccessToken } from "../../outputs/github/githubApiClient"
import { FileDownloadResult, StoredFile, buildGithubFileKey, ensureStoredWithMetadata } from "../../services/FileStorageService"
import { SecretService } from "../../services/SecretService"
import { urls } from "../../settings"
import { AgentTriggerWithConfigs } from "../../types/prisma"
import { resolveUserInOrg } from "../../utility/identity"
import { IntegrationCompletedTask } from "../IntegrationCompletedTask"
import { integrationTaskQueue } from "../IntegrationTaskQueues"
import { FetchResourcesOptions } from "../abstract/FetchResourcesOptions"
import { Integration, IntegrationWithResources, OAuthIntegrationInstallation, createConnectedCliDisplayState, createNotConnectedCliDisplayState } from "../abstract/Integration"
import { TriggerRuntime } from "../abstract/TriggerRuntime"

export class GithubIntegrationManager
    extends Integration<GithubIntegration, GithubTrigger, typeof GithubIntegrationMetadata, Repository>
    implements OAuthIntegrationInstallation<IntegrationType.GITHUB>
{
    readonly integrationType = IntegrationType.GITHUB
    readonly settingsKey = "githubApp"
    readonly secretSchema = z.object({
        accessToken: z.string()
    })

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return []
    }

    async getInstancesForOrganization(organizationId: string): Promise<GithubIntegration[]> {
        const organizationAccounts = await db().github_app_tokens.findMany({
            where: { organization_id: organizationId }
        })
        const installations = await Promise.all(
            organizationAccounts.map(async oa => {
                const secrets = await this.secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: oa.id } })
                if (!secrets) {
                    logger.warn(`Github app token ${oa.id} is missing its secret blob; skipping`, { integrationId: oa.id })
                    return []
                }

                const appInstallations = await getAppInstallationsForUser(secrets.accessToken, {
                    userId: oa.user_id,
                    tokenId: oa.id
                })
                return appInstallations.installations.map(ai => ({
                    id: ai.id.toString(),
                    installation_id: ai.id,
                    account_name: ai.account.login
                }))
            })
        )
        return installations.flat()
    }

    async getCliDisplayStateForOrganization(organizationId: string) {
        const token = await db().github_app_tokens.findFirst({
            where: { organization_id: organizationId },
            orderBy: { created_at: "asc" }
        })

        if (!token) {
            return createNotConnectedCliDisplayState()
        }

        return createConnectedCliDisplayState("Account", token.github_username, token.id)
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

    async processWebhookEvent(event: GithubTrigger): Promise<void> {
        const userIds = await resolveUserIdsForGithubInstallation(event.installationId)

        if (userIds.length === 0) {
            logger.warn(`⚠️  No users found for GitHub event from ${event.installationId}`, { installationId: event.installationId, eventType: event.eventType })
            return
        }

        for (const userId of userIds) {
            const token = await db().github_app_tokens.findFirst({
                where: { user_id: userId },
                select: { id: true, organization_id: true }
            })
            if (!token?.organization_id) continue
            const fullUser = await resolveUserInOrg(userId, token.organization_id)
            if (!fullUser) continue
            const secrets = await this.secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: token.id } })
            if (!secrets) {
                logger.warn(`Github app token ${token.id} is missing its secret blob; skipping`, { integrationId: token.id })
                continue
            }
            const storedFiles: StoredFile[] = await getPullRequestFiles(event, secrets.accessToken, event.installationId.toString())
            await runWithUserContext(fullUser, async () => {
                const githubEvent = new GithubTriggerRuntime(event, storedFiles)
                const eventProcessor = new EventProcessor(githubEvent, fullUser)
                await eventProcessor.process()
            })
        }
    }

    async getInstallationUrl(
        userId: string,
        organizationId: string,
        options: InstallationOptionsFor<IntegrationType.GITHUB>,
        additionalStatePayload: AdditionalStateParams | undefined,
        req: Request,
        res: Response
    ): Promise<OAuthInstallationDetails> {
        const appName = this.config.appName
        const clientId = this.config.clientId
        const redirectUri = this.config.integrateCallbackUrl

        const state = mintOAuthState(req, res, {
            userId,
            organizationId,
            additionalStatePayload
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
            const stateData = verifyOAuthState(req, res, state as string)
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

            // parse installation_id as number
            const installation_id_number = parseInt(installation_id as string)
            if (isNaN(installation_id_number)) {
                logger.error("[GitHub Setup URL Installation] ERROR: Installation ID is not a number", { installationId: installation_id, userId: user_id })
                res.status(400).json({ message: "Installation ID is not a number" })
                return
            }

            const authToken = await exchangeCodeForAccessToken(code)
            const githubAppUser = await getGithubAppUser(authToken.access_token)

            const { githubTokenId } = await db().$transaction(async prisma => {
                const githubToken = await prisma.github_app_tokens.upsert({
                    where: {
                        user_id_github_username: {
                            user_id: user_id,
                            github_username: githubAppUser.login
                        }
                    },
                    update: {
                        organization_id: organizationId
                    },
                    create: {
                        user_id: user_id,
                        github_username: githubAppUser.login,
                        organization_id: organizationId
                    }
                })

                return {
                    githubTokenId: githubToken.id
                }
            })

            await this.secretService.createSecrets({
                type: "integration",
                secret: {
                    integrationType: IntegrationType.GITHUB,
                    recordId: githubTokenId,
                    value: { accessToken: authToken.access_token }
                }
            })

            logger.info("[GitHub Setup URL Installation] Upsert completed", {
                installationId: installation_id_number,
                userId: user_id
            })

            // Emit integration completed task (includes full state payload for chat metadata detection)
            // Note: GitHub uses base64-encoded JSON state, so we decode it and pass as statePayload
            integrationTaskQueue.emit(new IntegrationCompletedTask(IntegrationType.GITHUB, githubTokenId, user_id, stateData, new Date()))

            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`)
        } catch (error) {
            logger.error("[GitHub Setup URL Installation] Callback error", {
                error,
                installationId: installation_id
            })
            res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.ERROR}`)
        }
    }

    async deleteInstallation(integrationId: string): Promise<void> {
        try {
            const secrets = await this.secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: integrationId } })
            if (secrets?.accessToken) {
                const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")
                const response = await fetch(`https://api.github.com/applications/${this.config.clientId}/token`, {
                    method: "DELETE",
                    headers: {
                        Authorization: `Basic ${basic}`,
                        Accept: "application/vnd.github+json",
                        "Content-Type": "application/json",
                        "X-GitHub-Api-Version": "2022-11-28"
                    },
                    body: JSON.stringify({ access_token: secrets.accessToken })
                })
                if (!response.ok && response.status !== 422 && response.status !== 404) {
                    // 422/404 mean the token was already invalidated; treat as success.
                    logger.warn("GitHub token revocation returned non-OK", { status: response.status, integrationId })
                } else {
                    logger.info(`Revoked GitHub OAuth token`, { integrationId })
                }
            }
        } catch (error) {
            logger.warn("Failed to revoke GitHub OAuth token on disconnect", { error, integrationId })
        }

        await db().$transaction(async tx => {
            await tx.github_app_tokens.delete({ where: { id: integrationId } })
        })
        await this.secretService.deleteSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: integrationId } })
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
        return null
    }

    async getAllActiveInstances(): Promise<GithubIntegration[]> {
        // not needed for github integration
        return []
    }

    async getSampleEvents(integrationId: string, organizationId: string, userId: string, triggerConfig: ConfigData, options?: { limit?: number }): Promise<TriggerRuntime[]> {
        if (triggerConfig.configType !== ConfigType.GITHUB) {
            return []
        }
        const githubConfig = GitHubConfigSchema.parse(triggerConfig)

        const maxEvents = Math.min(options?.limit ?? 6, 10)

        const installations = await this.getInstancesForOrganization(organizationId)
        const installation = installations.find(i => i.id === integrationId)
        if (!installation) {
            throw new Error(`GitHub integration ${integrationId} not found`)
        }

        const installationIdNum = installation.installation_id

        const accessToken = await getGitHubAccessToken(userId, organizationId)
        if (!accessToken) {
            throw new Error("No GitHub token found for user. Please connect your GitHub account.")
        }
        const userInstallations = await getAppInstallationsForUser(accessToken, {
            userId,
            installationId: installationIdNum
        })
        if (!userInstallations.installations.some(inst => inst.id === installationIdNum)) {
            throw new Error("Installation not found or access denied.")
        }

        let repos: Array<{ id: number; owner: string; name: string; defaultBranch: string }> = []

        if (githubConfig.repositoryIds?.length) {
            for (const repoId of githubConfig.repositoryIds) {
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

        const requestedTypes = githubConfig.eventTypes ?? []
        if (requestedTypes.length === 0) {
            return []
        }
        const wantsPush = requestedTypes.includes(GitHubEventType.PUSH)

        const requestedPRTypes = requestedTypes.filter(t => t.startsWith("pull_request."))
        const wantsPR = requestedPRTypes.length > 0
        const prApiState = derivePRApiState(requestedPRTypes)

        const events: TriggerRuntime[] = []
        for (const repo of repos) {
            if (wantsPush) {
                const commits = await fetchRecentCommitsForSample(accessToken, repo.owner, repo.name, 5)
                for (const commit of commits) {
                    const eventData = await createPushEventData(commit, repo, installationIdNum, accessToken)
                    if (eventData) events.push(new GithubTriggerRuntime(eventData, []))
                }
            }
            if (wantsPR) {
                const pullRequests = await fetchRecentPullRequestsForSample(accessToken, repo.owner, repo.name, 5, prApiState)
                for (const pr of pullRequests) {
                    if (!prMatchesRequestedTypes(pr, requestedPRTypes)) continue
                    const eventData = await createPullRequestEventData(pr, repo, installationIdNum, accessToken)
                    if (!eventData) continue
                    const storedFiles = await getPullRequestFiles(eventData, accessToken, installationIdNum.toString())
                    events.push(new GithubTriggerRuntime(eventData, storedFiles))
                }
            }
            if (events.length >= maxEvents) break
        }

        return events.slice(0, maxEvents)
    }
}

// MARK: - GithubTriggerRuntime

function prActionLabel(eventType: GitHubEventType): string {
    switch (eventType) {
        case GitHubEventType.PR_OPENED:
            return "opened"
        case GitHubEventType.PR_MERGED:
            return "merged"
        case GitHubEventType.PR_CLOSED:
            return "closed"
        case GitHubEventType.PR_SYNCHRONIZE:
            return "updated"
        default:
            return eventType
    }
}

export class GithubTriggerRuntime extends TriggerRuntime<GithubTrigger> implements Identifiable {
    readonly integrationType = IntegrationType.GITHUB
    readonly entityType = "github_event"
    entityId: string
    data: GithubTrigger
    private storedFiles: StoredFile[]

    constructor(data: GithubTrigger, storedFiles: StoredFile[] = []) {
        super()
        this.data = data
        this.storedFiles = storedFiles
        if (data.pullRequest) {
            this.entityId = `${data.installationId}:${data.repository.id}:pr/${data.pullRequest.number}`
        } else if (data.commits?.length) {
            this.entityId = `${data.installationId}:${data.repository.id}:commit/${data.commits[0].sha}`
        } else {
            this.entityId = `${data.installationId}:${data.repository.id}:push/${data.branch ?? "main"}`
        }
    }

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.GITHUB) {
            return false
        }
        const githubConfig = agentTrigger.github_config

        // Make sure the repository is in the list of repositories configured for the channel
        if (!githubConfig?.repository_ids.includes(this.data.repository.id)) {
            logger.debug("GithubTriggerRuntime matchesAgentTrigger - repository not found in channel", {
                repositoryId: this.data.repository.id,
                repositoryIds: githubConfig?.repository_ids,
                agentTriggerId: agentTrigger.id
            })
            return false
        }

        // Check if the eventType is included in the eventTypes configured for the channel
        return !githubConfig.event_types || githubConfig.event_types.length === 0 || githubConfig.event_types.includes(this.data.eventType)
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return buildGithubTriggerMetadata(this.data)
    }

    getFiles(): StoredFile[] {
        return this.storedFiles
    }
}

/**
 * Pure builder for the RunHistory trigger metadata shown in the UI for a GitHub event.
 *
 * Exported so synthetic / sample-event flows (e.g. `SyntheticTriggerRuntime` in
 * `modules/triggers/schedule.ts`) can produce the same rich title/subheader/url as real webhook
 * deliveries, rather than falling back to a bare `debugLog()` string like
 * "GitHub Event: pull_request.merged - owner/repo - user".
 */
export function buildGithubTriggerMetadata(data: GithubTrigger): RunHistoryTrigger {
    const { eventType, username, repositoryName, pullRequest, commits, branch } = data

    const base = {
        event: "github_event",
        integration: IntegrationType.GITHUB,
        source: repositoryName
    } as const

    if (pullRequest) {
        const action = prActionLabel(eventType)
        return {
            ...base,
            title: `#${pullRequest.number} ${pullRequest.title}`.trim(),
            subheader: `${username} ${action} PR in ${repositoryName}`,
            url: pullRequest.url || `https://github.com/${repositoryName}/pull/${pullRequest.number}`
        }
    }

    if (eventType === GitHubEventType.PUSH) {
        const firstCommit = commits?.[0]
        const commitMessage = (firstCommit?.message ?? firstCommit?.name ?? "").split("\n")[0]
        const commitCount = commits?.length ?? 0
        const title = commitCount > 1 ? `${commitCount} commits to ${branch}` : commitMessage || `Push to ${branch}`
        return {
            ...base,
            title,
            subheader: `${username} pushed to ${branch} in ${repositoryName}`,
            url: firstCommit ? `https://github.com/${repositoryName}/commit/${firstCommit.sha}` : `https://github.com/${repositoryName}/tree/${branch}`
        }
    }

    return {
        ...base,
        title: eventType,
        subheader: `${username} in ${repositoryName}`,
        url: `https://github.com/${repositoryName}/`
    }
}

// MARK: - Helper Functions - GITHUB REST API
async function getGithubAppUser(githubAppAccessToken: string): Promise<GithubAppUser> {
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

async function exchangeCodeForAccessToken(
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
            client_id: new GithubIntegrationManager().config.clientId,
            client_secret: new GithubIntegrationManager().config.clientSecret,
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

export type GithubInstallationsContext = {
    userId: string
    tokenId?: string
    installationId?: number
}

export async function getAppInstallationsForUser(oAuthToken: string, context: GithubInstallationsContext): Promise<GithubAppInstallationResponse> {
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
        const status = axios.isAxiosError(error) ? error.response?.status : undefined
        const logFields = { ...context, status, error }
        if (status === 401) {
            logger.warn("GitHub app installations fetch returned 401 (token likely revoked)", logFields)
        } else {
            logger.error("Error getting app installations for user", logFields)
        }
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

// Given an installation, return the user ids associated with that installation.
async function resolveUserIdsForGithubInstallation(installationId: number): Promise<string[]> {
    const secretService = SecretService.getInstance()
    const githubAppUsers = await db().github_app_tokens.findMany()
    const installationResults = await Promise.all(
        githubAppUsers.map(async user => {
            const secrets = await secretService.tryGetSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: user.id } })
            if (!secrets) {
                logger.warn(`Github app token ${user.id} is missing its secret blob; skipping`, { integrationId: user.id })
                return { userId: user.user_id, installations: [] }
            }
            const installations = await getAppInstallationsForUser(secrets.accessToken, {
                userId: user.user_id,
                tokenId: user.id,
                installationId
            })
            return { userId: user.user_id, installations: installations.installations }
        })
    )
    const userIds = installationResults.filter(result => result.installations.some(inst => inst.id === installationId)).map(result => result.userId)
    logger.debug(`Found ${userIds.length} users for event from installation`, { installationId, userCount: userIds.length })
    return userIds
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
        select: { id: true }
    })

    if (!accessToken) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: no GitHub access token found for user`)
    }
    const secretService = SecretService.getInstance()
    const secrets = await secretService.getSecrets({ type: "integration", secret: { integrationType: IntegrationType.GITHUB, recordId: accessToken.id } })
    const resolvedAccessToken = secrets.accessToken

    const integrationInstallationId = Number(integrationId)
    const installations = await getAppInstallationsForUser(resolvedAccessToken, {
        userId,
        tokenId: accessToken.id,
        installationId: Number.isNaN(integrationInstallationId) ? undefined : integrationInstallationId
    })
    const targetInstallation = installations.installations.find(installation => (!Number.isNaN(integrationInstallationId) ? installation.id === integrationInstallationId : false))

    if (!targetInstallation) {
        throw new Error(`Invalid ${contextLabel} config for ${configTypeLabel}: installation not found`)
    }

    const repositories = await getAppInstallationRepositories(resolvedAccessToken, targetInstallation.id)

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

/**
 * Map requested PR event types to the GitHub API `state` param to avoid fetching irrelevant PRs.
 * Returns "all" when both open and closed states are needed.
 */
function derivePRApiState(requestedPRTypes: GitHubEventType[]): "open" | "closed" | "all" {
    if (requestedPRTypes.length === 0) return "all"

    const needsOpen = requestedPRTypes.some(t => t === GitHubEventType.PR_OPENED || t === GitHubEventType.PR_SYNCHRONIZE)
    const needsClosed = requestedPRTypes.some(t => t === GitHubEventType.PR_MERGED || t === GitHubEventType.PR_CLOSED)

    if (needsOpen && needsClosed) return "all"
    if (needsClosed) return "closed"
    return "open"
}

function prMatchesRequestedTypes(pr: OctokitPullRequest, requestedPRTypes: GitHubEventType[]): boolean {
    if (requestedPRTypes.length === 0) return true

    const isMerged = pr.merged_at !== null
    const isOpen = pr.state === "open"

    return requestedPRTypes.some(t => {
        switch (t) {
            case GitHubEventType.PR_OPENED:
            case GitHubEventType.PR_SYNCHRONIZE:
                return isOpen
            case GitHubEventType.PR_MERGED:
                return isMerged
            case GitHubEventType.PR_CLOSED:
                return !isOpen && !isMerged
            default:
                return false
        }
    })
}

async function fetchRecentPullRequestsForSample(accessToken: string, owner: string, repo: string, count: number, state: "open" | "closed" | "all" = "all"): Promise<OctokitPullRequest[]> {
    try {
        const octokit = createOctokitForSample(accessToken)
        const response = await octokit.rest.pulls.list({
            owner,
            repo,
            state,
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
): Promise<GithubTrigger | null> {
    try {
        const commitDetails = await fetchCommitDiffForSample(accessToken, repo.owner, repo.name, commit.sha)
        if (!commitDetails) return null

        const fileDiffs = (commitDetails.files || []).map(file => ({
            filename: file.filename!,
            diff: file.patch || ""
        }))

        return {
            integrationType: IntegrationType.GITHUB,
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
): Promise<GithubTrigger | null> {
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
            integrationType: IntegrationType.GITHUB,
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

export async function getPullRequestFiles(event: GithubTrigger, token: string, integrationId: string): Promise<StoredFile[]> {
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
        const contentType = response.headers["content-type"]?.toString() || "application/octet-stream"
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

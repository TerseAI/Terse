import { Integration, OAuthIntegrationInstallation, ConfigurationFieldDefinition, IntegrationWithResources } from "./abstract/Integration";
import { db } from "../prismaClient";
import { EventProcessor } from "../agent/AgentRunner/EventProcessor";
import { InputEvent } from "./abstract/InputEvent";
import { GithubIntegration, GithubIntegrationMetadata, IntegrationType, InstallationOptionsFor, AdditionalStateParams } from "../shared/Integrations";
import { GithubAppInstallation, GithubAppInstallationRepository, GithubAppInstallationRepositoryResponse, GithubAppInstallationResponse, GithubAppUnifiedEventRequest } from "../routes/GithubTypes";
import { User } from "../types/prisma";
import { AgentTriggerWithConfigs } from "../types/prisma";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { OAuthInstallationDetails, Repository } from "../shared/types";
import { githubApp, urls } from "../config/settings";
import { Request, Response } from "express";
import { InputConfigType } from "@prisma/client";
import axios, { AxiosResponse } from "axios";
import { GithubAppUser } from "../routes/GithubTypes";
import logger, { runWithUserContext } from "../logger";
import { integrationTaskQueue } from "./IntegrationTaskQueues";
import { IntegrationCompletedTask } from "./IntegrationCompletedTask";
import { createOAuthStateToken, decodeOAuthStateToken, OAuthStateEncodingFormat } from "../utility/oauth";
import { FrontendRoutes } from "../shared/FrontendRoutes";
import {
    StoredFile,
} from "../services/FileStorageService";

export class GithubIntegrationManager implements Integration<GithubIntegration, GithubAppUnifiedEventRequest, typeof GithubIntegrationMetadata, Repository>, OAuthIntegrationInstallation<IntegrationType.GITHUB> {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.GITHUB;

    getConfigurationFields(): ConfigurationFieldDefinition[] {
        return [];
    }

    async getInstancesForUser(userId: string): Promise<GithubIntegration[]> {
        const userAccounts = await db().github_app_tokens.findMany({
            where: { user_id: userId }
        });
        const installations = await Promise.all(userAccounts.map(async (ua) => {
            const appInstallations = await getAppInstallationsForUser(ua.access_token);
            return appInstallations.installations.map(ai => ({
                id: ai.id.toString(),
                installation_id: ai.id,
                account_name: ai.account.login,
            }));
        }));
        return installations.flat();
    }

    formatIntegrationInstanceForAgent(instance: GithubIntegration): string {
        const details: string[] = [];
        if (instance.account_name) {
            details.push(`account "${instance.account_name}"`);
        }
        if (instance.installation_id) {
            details.push(`installationId ${instance.installation_id}`);
        }
        const detailText = details.length ? ` (${details.join(", ")})` : "";
        return `Github${detailText} [id: ${instance.id}]`;
    }

    async getAllActiveInstances(): Promise<GithubIntegration[]> {
        const userGithubInstallations = await db().user_github_installation.findMany({
            select: {
                id: true,
                installation_id: true,
                account_name: true,
            }
        });
        return userGithubInstallations.map(ugi => ({
            id: ugi.id,
            installation_id: ugi.installation_id,
            account_name: ugi.account_name || null,
        }));
    }

    async processWebhookEvent(event: GithubAppUnifiedEventRequest): Promise<void> {
        const users: User[] = await resolveUsersForGithubInstallation(event.installationId);

        if (users.length === 0) {
            logger.warn(`⚠️  No users found for GitHub event from ${event.installationId}`, { installationId: event.installationId, eventType: event.eventType });
            return;
        }

        for (const user of users) {
            // Process with user context for logging
            await runWithUserContext(user.id, user.email, async () => {
                const githubEvent = new GithubEvent(event, []);
                const eventProcessor = new EventProcessor(githubEvent, user);
                await eventProcessor.process();
            });
        }
    }

    async getInstallationUrl(userId: string, options?: InstallationOptionsFor<IntegrationType.GITHUB>, additionalStatePayload?: AdditionalStateParams): Promise<OAuthInstallationDetails> {
        const appName = githubApp.appName;
        const clientId = githubApp.clientId;
        const redirectUri = githubApp.integrateCallbackUrl;
        
        // Generate state token using helper function (handles merging and encoding)
        const state = createOAuthStateToken({
            userId,
            additionalStatePayload,
            encodingFormat: OAuthStateEncodingFormat.BASE64,
        });
        
        const installationUrl: string = `https://github.com/apps/${appName}/installations/new?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&target_type=repositories&state=${state}`;

        return {
            oauthUrl: installationUrl
        };
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { installation_id, setup_action, state, code } = req.query as { installation_id: string; setup_action: string; state: string; code: string };

        logger.info("[GitHub Setup URL Installation]", { installationId: installation_id, setupAction: setup_action, hasState: !!state });

        // Decode state using helper function
        const stateData = decodeOAuthStateToken(state as string);
        const user_id = stateData.userId;
        const user: User | null = await db().users.findUnique({
            where: { id: user_id }
        });

        if (!user) {
            logger.error("[GitHub Setup URL Installation] ERROR: User not found", { userId: user_id, installationId: installation_id });
            res.status(400).json({ message: 'User not found' });
            return;
        }

        // parse installation_id as number
        const installation_id_number = parseInt(installation_id as string);
        if (isNaN(installation_id_number)) {
            logger.error("[GitHub Setup URL Installation] ERROR: Installation ID is not a number", { installationId: installation_id, userId: user_id });
            res.status(400).json({ message: 'Installation ID is not a number' });
            return;
        }

        // create a new user_github_installation record
        // Note: account_name will be populated by the webhook callback if not already set
        const githubInstallation = await db().user_github_installation.upsert({
            where: { installation_id: installation_id_number },
            update: { user_id: user_id },
            create: { user_id: user_id, installation_id: installation_id_number }
        });

        const authToken = await exchangeCodeForAccessToken(code);
        const githubAppUser = await getGithubAppUser(authToken.access_token);

        await db().github_app_tokens.upsert({
            where: { user_id_github_username: { user_id: user_id, github_username: githubAppUser.login } },
            update: { access_token: authToken.access_token },
            create: { user_id: user_id, github_username: githubAppUser.login, access_token: authToken.access_token }
        });

        logger.info("[GitHub Setup URL Installation] Upsert completed", { installationId: installation_id_number, userId: user_id });

        // Emit integration completed task (includes full state payload for chat metadata detection)
        // Note: GitHub uses base64-encoded JSON state, so we decode it and pass as statePayload
        integrationTaskQueue.emit(new IntegrationCompletedTask(
            IntegrationType.GITHUB,
            githubInstallation.id, // Use user_github_installation.id as integrationId
            user_id,
            stateData,
            new Date()
        ));

        res.redirect(`${urls.frontend}${FrontendRoutes.OAUTH.SUCCESS}`);
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve();
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
        return false;
    }

    async getAccessToken(integrationId: string): Promise<string | null> {
        // GitHub App uses installation-based authentication, not traditional OAuth tokens
        // Tokens are generated on-demand using JWT and the installation ID
        // This method returns null because we don't store access tokens in the database
        // Token generation happens elsewhere when making API calls (typically using GitHub App's private key)
        try {
            const installation = await db().user_github_installation.findUnique({
                where: { id: integrationId },
            });

            if (!installation) {
                logger.error(`GitHub installation ${integrationId} not found`, { integrationId });
                return null;
            }

            // GitHub App installations don't store access tokens
            // They generate tokens on-demand using the installation ID and App credentials
            // Return null to indicate tokens must be generated via GitHub App flow
            return null;
        } catch (error) {
            logger.error(`Error getting GitHub access token for installation ${integrationId}`, { error, integrationId });
            return null;
        }
    }

    async fetchResourcesForInstance(userId: string, installationId: string, query?: string): Promise<Repository[]> {
        const accessToken = await db().github_app_tokens.findFirst({ where: { user_id: userId } });
        if (!accessToken) {
            throw new Error("GitHub account not connected");
        }

        const installations = await getAppInstallationsForUser(accessToken.access_token);
        const targetInstallation = installations.installations.find(i => i.id === Number(installationId));
        if (!targetInstallation) {
            throw new Error("Installation not found");
        }

        const installationRepositories = await getAppInstallationRepositories(accessToken.access_token, targetInstallation.id);

        let repositories = installationRepositories.map(r => ({ id: r.id, name: r.name, owner: r.owner.login }));

        if (query) {
            const normalizedQuery = query.trim().toLowerCase();
            repositories = repositories.filter(repo =>
                repo.name.toLowerCase().includes(normalizedQuery) ||
                `${repo.owner}/${repo.name}`.toLowerCase().includes(normalizedQuery)
            );
        }

        return repositories;
    }

    async fetchResourcesForUser(userId: string, query?: string): Promise<IntegrationWithResources<GithubIntegration, Repository>[]> {
        const integrations = await this.getInstancesForUser(userId);
        return Promise.all(
            integrations.map(async (integration) => {
                const installationId = integration.installation_id ?? Number(integration.id);
                if (!installationId) {
                    return { integration, resources: [] };
                }
                try {
                    const resources = await this.fetchResourcesForInstance(userId, String(installationId), query);
                    return { integration, resources };
                } catch (error) {
                    logger.warn(`Failed to fetch resources for GitHub integration ${integration.id}`, { error, integrationId: integration.id });
                    return { integration, resources: [] };
                }
            })
        );
    }
}

// MARK: - GithubEvent

export class GithubEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.GITHUB;
    data: GithubAppUnifiedEventRequest;
    private storedFiles: StoredFile[];

    constructor(data: GithubAppUnifiedEventRequest, storedFiles: StoredFile[] = []) {
        super();
        this.data = data;
        this.storedFiles = storedFiles;
    }

    formatForAgentRunner(): string {
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

    matchesAgentTrigger(agentTrigger: AgentTriggerWithConfigs): boolean {
        if (agentTrigger.config_type !== InputConfigType.GITHUB) {
            return false;
        }
        const githubConfig = agentTrigger.github_config;

        // Make sure the repository is in the list of repositories configured for the channel
        if (!githubConfig?.repository_ids.includes(this.data.repository.id)) {
            logger.debug('GithubEvent matchesAgentTrigger - repository not found in channel', { repositoryId: this.data.repository.id, repositoryIds: githubConfig?.repository_ids, agentTriggerId: agentTrigger.id });
            return false;
        }

        return true
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: 'github_event',
            integration: IntegrationType.GITHUB,
            source: this.data.repositoryName,
            title: this.data.eventType,
            subheader: this.data.username,
            url: `https://github.com/${this.data.repositoryName}/`,
        };
    }

    getFiles(): StoredFile[] {
        // Return all stored files with full metadata
        return this.storedFiles;
    }
}

// MARK: - Helper Functions - GITHUB REST API
export async function getGithubAppUser(githubAppAccessToken: string): Promise<GithubAppUser> {
    const resp = await axios.get(
        'https://api.github.com/user',
        {
            headers: {
                Authorization: `Bearer ${githubAppAccessToken}`,
                Accept: 'application/vnd.github+json',
            }
        }
    );

    logger.debug('Github App user retrieved', { userId: resp.data.id, login: resp.data.login });
    return resp.data;
}

export async function exchangeCodeForAccessToken(code: string, redirectUri?: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const tokenResp = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
            client_id: githubApp.clientId,
            client_secret: githubApp.clientSecret,
            code,
            ...(redirectUri && { redirect_uri: redirectUri }),
        },
        {
            headers: { Accept: 'application/json' },
        }
    );

    const accessToken = tokenResp.data.access_token;
    const refreshToken = tokenResp.data.refresh_token;
    const expiresIn = tokenResp.data.expires_in;
    return { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn };
}

export async function getAppInstallationsForUser(oAuthToken: string): Promise<GithubAppInstallationResponse> {
    try {
        const allInstallations: GithubAppInstallation[] = [];
        let page = 1;
        const perPage = 100; // Max allowed by GitHub API

        while (true) {
            const resp: AxiosResponse<GithubAppInstallationResponse> = await axios.get(
                'https://api.github.com/user/installations',
                {
                    headers: {
                        Authorization: `Bearer ${oAuthToken}`,
                        Accept: 'application/vnd.github+json',
                    },
                    params: {
                        per_page: perPage,
                        page,
                    },
                }
            );

            allInstallations.push(...resp.data.installations);

            // If we got fewer than perPage, we've reached the last page
            if (resp.data.installations.length < perPage) {
                break;
            }

            page++;
        }

        return { total_count: allInstallations.length, installations: allInstallations };
    } catch (error) {
        logger.error('Error getting app installations for user', { error });
        return { total_count: 0, installations: [] };
    }
}

export async function getAppInstallationRepositories(oAuthToken: string, installationId: number): Promise<GithubAppInstallationRepository[]> {
    const allRepositories: GithubAppInstallationRepository[] = [];
    let page = 1;
    const perPage = 100; // Max allowed by GitHub API

    while (true) {
        const resp: AxiosResponse<GithubAppInstallationRepositoryResponse> = await axios.get(
            `https://api.github.com/user/installations/${installationId}/repositories`,
            {
                headers: {
                    Authorization: `Bearer ${oAuthToken}`,
                    Accept: 'application/vnd.github+json',
                },
                params: {
                    per_page: perPage,
                    page,
                },
            }
        );

        allRepositories.push(...resp.data.repositories);

        // If we got fewer than perPage, we've reached the last page
        if (resp.data.repositories.length < perPage) {
            break;
        }

        page++;
    }

    return allRepositories;
}

// Given an installation, we need to fetch all users that are associated with that installation.
// This doesn't guarantee that they have an active input config, but it's a good start.
// This is super inefficient, but it's a good start. We need to optimize this.
export async function resolveUsersForGithubInstallation(installationId: number): Promise<User[]> {
    return db().$transaction(async (tx) => {
        // Get all of our github app users.
        const githubAppUsers = await tx.github_app_tokens.findMany();

        // for each github App user, get their installations they have access to. Return a Map<user_id, installations>
        const installationResults = await Promise.all(githubAppUsers.map(async (user) => {
            const installations = await getAppInstallationsForUser(user.access_token);
            return { userId: user.user_id, installations: installations.installations };
        }));

        // Find users who have access to the specific installation
        const userIds = installationResults
            .filter(result => result.installations.some(inst => inst.id === installationId))
            .map(result => result.userId);

        // Fetch and return the User objects
        const users = await tx.users.findMany({
            where: { id: { in: userIds } }
        });

        logger.debug(`Found ${users.length} users for event from installation`, { installationId, userCount: users.length });

        return users;
    });
}
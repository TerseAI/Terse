import { Integration, OAuthIntegrationInstallation } from "./abstract/Integration";
import { db } from "../prismaClient";
import chalk from "chalk";
import { EventProcessor } from "../agent/ChannelAgent/EventProcessor";
import { InputEvent } from "./abstract/InputEvent";
import { GithubIntegration, GithubIntegrationMetadata, IntegrationType } from "../shared/Integrations";
import { GithubAppInstallationRepository, GithubAppInstallationRepositoryResponse, GithubAppInstallationResponse, GithubAppUnifiedEventRequest } from "../routes/GithubTypes";
import { resolveUsersForGithubInstallation } from "../routes/github";
import { User } from "../types/prisma";
import { ChannelInputWithConfigs } from "../types/prisma";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { OAuthInstallationDetails } from "../shared/types";
import { githubApp, urls } from "../config/settings";
import { Request, Response } from "express";
import { InputConfigType } from "@prisma/client";
import axios, { AxiosResponse } from "axios";
import { GithubAppUser } from "../routes/GithubTypes";

export class GithubIntegrationManager implements Integration<GithubIntegration, GithubAppUnifiedEventRequest, typeof GithubIntegrationMetadata>, OAuthIntegrationInstallation {
    constructor() { }
    integrationType: IntegrationType = IntegrationType.GITHUB;

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
            console.log(chalk.yellow(`⚠️  No users found for GitHub event from ${event.installationId}`));
            return;
        }
        
        for (const user of users) {
            const githubEvent = new GithubEvent(event);
            const eventProcessor = new EventProcessor(githubEvent, user);
            await eventProcessor.process();
        }
    }

    async getInstallationUrl(userId: string): Promise<OAuthInstallationDetails> {
        const appName = githubApp.appName;
        const clientId = githubApp.clientId;
        const redirectUri = githubApp.integrateCallbackUrl;
        const state = Buffer.from(userId).toString('base64');
        const installationUrl: string = `https://github.com/apps/${appName}/installations/new?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&target_type=repositories&state=${state}`;

        return {
            oauthUrl: installationUrl
        };
    }

    async processInstallationCallback(req: Request, res: Response): Promise<void> {
        const { installation_id, setup_action, state, code } = req.query as { installation_id: string; setup_action: string; state: string; code: string };

        console.log(
            chalk.bgBlue.white.bold("[GitHub Setup URL Installation]"),
            chalk.cyan("installation_id:"), chalk.yellow(installation_id),
            chalk.cyan("setup_action:"), chalk.yellow(setup_action),
            chalk.cyan("state:"), chalk.yellow(state)
        );

        // extract user_id from state
        const user_id = Buffer.from(state as string, 'base64').toString('utf-8');
        const user: User | null = await db().users.findUnique({
            where: { id: user_id }
        });

        if (!user) {
            console.error(chalk.red.bold("[GitHub Setup URL Installation]"), chalk.red("ERROR: User not found"));
            res.status(400).json({ message: 'User not found' });
            return;
        }

        // parse installation_id as number
        const installation_id_number = parseInt(installation_id as string);
        if (isNaN(installation_id_number)) {
            console.error(chalk.red.bold("[GitHub Setup URL Installation]"), chalk.red("ERROR: Installation ID is not a number:"), installation_id);
            res.status(400).json({ message: 'Installation ID is not a number' });
            return;
        }

        // create a new user_github_installation record
        // Note: account_name will be populated by the webhook callback if not already set
        await db().user_github_installation.upsert({
            where: { installation_id: installation_id_number },
            update: { user_id: user_id },
            create: { user_id: user_id, installation_id: installation_id_number }
        });

        const authToken = await exchangeCodeForAccessToken(code);
        const githubAppUser = await getGithubAppUser(authToken.access_token);

        await db().github_app_tokens.upsert({
            where: { user_id_github_username: { user_id: user_id, github_username: githubAppUser.name } },
            update: { access_token: authToken.access_token, refresh_token: authToken.refresh_token, token_expiry: new Date(Date.now() + authToken.expires_in * 1000) },
            create: { user_id: user_id, github_username: githubAppUser.name, access_token: authToken.access_token, refresh_token: authToken.refresh_token, token_expiry: new Date(Date.now() + authToken.expires_in * 1000) }
        });

        console.log(
            chalk.green("[GitHub Setup URL Installation]"),
            chalk.cyan("Upsert completed for installation_id:"), chalk.yellow(installation_id_number),
            chalk.cyan("user_id:"), chalk.yellow(user_id)
        );

        res.redirect(`${urls.frontend}/oauth/success`);
    }

    deleteInstallation(integrationId: string): Promise<void> {
        return Promise.resolve();
    }

    async setupChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void> {
        // GitHub doesn't require any setup for channel inputs
        // Webhooks are managed at the integration level
    }

    async teardownChannelInput(integrationId: string, channelInput: ChannelInputWithConfigs): Promise<void> {
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
                console.error(`GitHub installation ${integrationId} not found`);
                return null;
            }

            // GitHub App installations don't store access tokens
            // They generate tokens on-demand using the installation ID and App credentials
            // Return null to indicate tokens must be generated via GitHub App flow
            return null;
        } catch (error) {
            console.error(`Error getting GitHub access token for installation ${integrationId}:`, error);
            return null;
        }
    }
}

// MARK: - GithubEvent

export class GithubEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.GITHUB;
    data: GithubAppUnifiedEventRequest;

    constructor(data: GithubAppUnifiedEventRequest) {
        super();
        this.data = data;
    }

    formatForChannelAgent(): string {
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

    matchesChannelInput(channelInput: ChannelInputWithConfigs): boolean {
        if (channelInput.config_type !== InputConfigType.GITHUB) {
            return false;
        }
        const githubConfig = channelInput.github_config;

        // Make sure the repository is in the list of repositories configured for the channel
        if (!githubConfig?.repository_ids.includes(this.data.repository.id)) {
            console.log(chalk.red('GithubEvent matchesChannelInput'), 'repository not found in channel', this.data.repository.id, githubConfig?.repository_ids);
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

    getImageUrls(): string[] {
        return [];
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

    console.log('Github App user:', resp.data);
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
        const resp: AxiosResponse<GithubAppInstallationResponse> = await axios.get('https://api.github.com/user/installations', {
            headers: {
                Authorization: `Bearer ${oAuthToken}`,
                Accept: 'application/vnd.github+json',
            },
        });
        return resp.data;
    } catch (error) {
        console.error('Error getting app installations for user:', error);
        return { total_count: 0, installations: [] };
    }
}

export async function getAppInstallationRepositories(oAuthToken: string, installationId: number): Promise<GithubAppInstallationRepository[]> {
    const resp: AxiosResponse<GithubAppInstallationRepositoryResponse> = await axios.get(`https://api.github.com/user/installations/${installationId}/repositories`, {
        headers: {
            Authorization: `Bearer ${oAuthToken}`,
            Accept: 'application/vnd.github+json',
        },
    });
    return resp.data.repositories;
}
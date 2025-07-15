import chalk from "chalk";
import { Request, Response } from "express";
import { db } from "../prismaClient";
import { User, GithubRepository, UserGithubRepository, LinearApiKey } from "../types/prisma";
import Owner from "../theOwner/Owner";
import { Commit, UnifiedGitHubEvent } from "../theOwner/utility";
import { search } from "../searchClient";
import { Session } from "../server";
import { TicketManager } from "../ticketing/TicketIntegration";
import { getUserTicketManager } from "../types/user";
import { formatTitleForEvent } from "../feed/formatters";
import { ChangedItem, ChangeEventType } from "../shared/ModelEvents";

const GITHUB_APP_CLIENT_ID = process.env.GITHUB_CLIENT_ID

export async function getCurrentGithubIntegration(req: Request, res: Response) {
    if(!req.session?.user) {
        res.status(500).json({ message: 'User not found' });
        return;
    }

    const user: User = req.session.user;

    const user_github_relation: UserGithubRepository | null = await db().user_github_repositories.findFirst({ where: { user_id: user.id } });

    if(!user_github_relation) {
        res.status(404).json({ message: 'No GitHub integration found' });
        return;
    }

    const repository: GithubRepository | null = await db().github_repositories.findUnique({ where: { id: user_github_relation.github_repository_id } });

    if(!repository) {
        res.status(404).json({ message: 'No GitHub repository found' });
        return;
    }

    res.status(200).json({ repositoryName: repository.name });
}

// Get GitHub App installation URL
export async function getInstallationUrl(req: Request, res: Response) {
    try {
        // Generate GitHub App installation URL with callback
        const installationUrl: string = `https://github.com/apps/vectra-github/installations/new?client_id=${GITHUB_APP_CLIENT_ID}&state=vectra&target_type=repositories`;

        res.json({
            installationUrl
        });
    } catch (error) {
        console.error('Error generating installation URL:', error);
        res.status(500).json({ message: 'Failed to generate installation URL' });
    }
}

type GithubAppInstallationCallbackRequest = {
    name: string;
    email: string;
    username: string;
    installationId: number;
    repositories: Repository[];
}

export type Repository = {
    name: string;
    owner: string;
    id: number;
}

async function processRepository(
    repositoryData: Repository, 
    user: User, 
    installationId: number
): Promise<{ name: string; status: string; error?: string }> {
    console.log(chalk.blue('Processing repository:'), repositoryData);

    // Check if repository already exists
    let repository: GithubRepository | null = await db().github_repositories.findFirst({ 
        where: { 
            name: repositoryData.name, 
            owner: repositoryData.owner, 
            installation_id: installationId 
        } 
    });

    // Check if this user <-> repository is already associated
    if (repository) {
        const userRepository = await db().user_github_repositories.findFirst({ 
            where: { 
                user_id: user.id, 
                github_repository_id: repository.id 
            } 
        });

        if (userRepository) {
            console.log(chalk.yellow('User already associated with repository:'), repositoryData.name);
            return { name: repositoryData.name, status: 'already_associated' };
        }
    }

    try {
        // Create the repository if it doesn't exist
        if (!repository) {
            repository = await db().github_repositories.create({
                data: {
                    name: repositoryData.name,
                    owner: repositoryData.owner,
                    installation_id: installationId
                }
            });
            console.log(chalk.green('Repository created:'), repository);
        }

        // Associate the user with the repository
        await db().user_github_repositories.create({
            data: {
                user_id: user.id,
                github_repository_id: repository.id
            }
        });

        console.log(chalk.green('User associated with repository:'), repositoryData.name);
        return { name: repositoryData.name, status: 'associated' };

    } catch (error) {
        console.error(chalk.red('Error processing repository:'), repositoryData.name, error);
        return { 
            name: repositoryData.name, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        };
    }
}

export async function githubAppInstallationCallback(req: Request, res: Response) {
    const body: GithubAppInstallationCallbackRequest = req.body as GithubAppInstallationCallbackRequest;

    console.log('githubAppInstallationCallback', body);

    // Check if the user is regestered with us, no problem if not. Will make a placeholder user.
    let user: User | null = await db().users.findUnique({ where: { github_username: body.username } });
    if (!user) {
        user = await db().users.create({
            data: {
                github_username: body.username,
                is_placeholder: true,
                email: body.email,
                display_name: body.name
            }
        });

        console.log(chalk.green('Placeholder user created:'), user);
    }

    // Process each repository in the array
    const processedRepositories = await Promise.all(
        body.repositories.map(repositoryData => 
            processRepository(repositoryData, user, body.installationId)
        )
    );

    res.status(200).json({ 
        message: 'Repository installation callback processed', 
        processedRepositories 
    });
}

type GithubAppInstallationDeletedRequest = {
    username: string;
    installationId: number;
}

export async function githubAppInstallationDeleted(req: Request, res: Response) {
    console.log('githubAppInstallationDeleted', req.body);
    const body: GithubAppInstallationDeletedRequest = req.body as GithubAppInstallationDeletedRequest;

    // find all repos for this installation
    const repositories: GithubRepository[] = await db().github_repositories.findMany({ where: { installation_id: body.installationId } });

    if (repositories.length === 0) {
        res.status(404).json({ message: 'No repositories found for this installation' });
        return;
    }

    // remove all associations for those repos
    await db().user_github_repositories.deleteMany({ where: { github_repository_id: { in: repositories.map(repo => repo.id) } } });

    // now remove the installation
    await db().github_repositories.deleteMany({ where: { installation_id: body.installationId } });

    res.status(200).json({ message: 'Repositories removed from user' });
}

type GithubAppRecievedCommitRequest = {
    username: string;
    installationId: number;
    repositoryName: string;
    commit: {
        id: string;
        message: string;
        url: string;
        author: {
            name: string;
            email: string;
        }
    }
    diff: {
        added: string[];
        removed: string[];
        modified: string[];
    }
}

export async function githubAppRecievedCommit(req: Request, res: Response) {
    const body = req.body as GithubAppRecievedCommitRequest;

    console.log('githubAppRecievedCommit', body);

    // get the repository
    const repository: GithubRepository | null = await db().github_repositories.findFirst({ where: { name: body.repositoryName, owner: body.username, installation_id: body.installationId } });

    if (!repository) {
        res.status(404).json({ message: 'Repository not found' });
        return;
    }
}

// This is important. If we got this request, we know that the app is installed on their repo. IF it's not in our DB, we need to create it.
async function resolveUserGithubRelation(user: User, username: string, repositoryName: string, installationId: number): Promise<GithubRepository> {
    // Use a transaction to prevent race conditions when multiple events arrive simultaneously
    return await db().$transaction(async (tx) => {
        // check if the repository is in our DB
        let repository: GithubRepository | null = await tx.github_repositories.findFirst({ 
            where: { name: repositoryName, installation_id: installationId } 
        });
        
        if (!repository) {
            console.log(chalk.yellow('Drift detected. This repository is not in our DB but it is a registered repository in the github app. Creating it...'));
            repository = await tx.github_repositories.create({
                data: {
                    name: repositoryName,
                    owner: username,
                    installation_id: installationId
                }
            });
        }

        // Make sure the user is associated with the repository
        let relation: UserGithubRepository | null = await tx.user_github_repositories.findFirst({ 
            where: { user_id: user.id, github_repository_id: repository.id } 
        });
        
        if (!relation) {
            await tx.user_github_repositories.create({
                data: {
                    user_id: user.id,
                    github_repository_id: repository.id
                }
            });
        }

        return repository;
    });
}

type GithubAppUnifiedEventRequest = {
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
        name: string;
        owner: string;
        defaultBranch: string;
    };
    sender: {
        login: string;
        email?: string;
    };
}

export async function githubAppUnifiedEvent(req: Request, res: Response) {
    const body: GithubAppUnifiedEventRequest = req.body as GithubAppUnifiedEventRequest;

    const { username, repositoryName, installationId } = body;
    console.log(chalk.blue('githubAppUnifiedEvent'), body.eventType, body.repositoryName, body.username);

    try {
        // get the user with transaction safety
        let user: User | null = await db().$transaction(async (tx) => {
            let foundUser = await tx.users.findFirst({ where: { github_username: username } });
            if (!foundUser) {
                const email = username + '@username.ai';
                console.log(chalk.yellow('User not found, creating placeholder user with fake email ' + email));
                foundUser = await tx.users.create({
                    data: {
                        github_username: username,
                        is_placeholder: true,
                        email: email,
                        display_name: body.sender.login
                    }
                });
                console.log(chalk.green('Placeholder user created:'), foundUser);
            }
            return foundUser;
        });

        // resolve the user github relation
        const repository: GithubRepository= await resolveUserGithubRelation(user, username, repositoryName, installationId);

        // Create isolated session for this specific event
        const session: Session = {
            user: user,
            isUserInitiated: false,
            teamId: '',
            ticketManager: undefined,
        }

        console.log(chalk.blue('Processing event for user:', user.github_username, 'team:', session.teamId));

        // init an Owner with isolated session
        const owner: Owner = new Owner(search(), session)
        
        // handle the unified event with proper error handling
        const summary = await owner.handleUnifiedGitHubEvent(body);
        console.log(chalk.green('Saving activity event for changed items:'), summary);
        await saveActivityEvent(repository, body, summary, user.id);
        
        res.status(200).json({ message: 'GitHub event received and processed' });
    } catch (error) {
        console.error(chalk.red('Error processing GitHub event:'), error);
        res.status(500).json({ message: 'Error processing GitHub event', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}

async function saveActivityEvent(repository: GithubRepository, event: UnifiedGitHubEvent, summary: string, userId: string) {
    const githubActivityEvent = await db().activity_events.create({
        data: {
            user_id: userId,
            event_type: event.eventType === 'push' ? 'PUSH' : event.eventType === 'pull_request.opened' ? 'PULL_REQUEST_OPENED' : event.eventType === 'pull_request.synchronize' ? 'PULL_REQUEST_UPDATED' : event.eventType === 'pull_request.merged' ? 'PULL_REQUEST_MERGED' : event.eventType === 'pull_request.closed' ? 'PULL_REQUEST_CLOSED' : 'PUSH',
            title: summary,
            github_repository_id: repository.id
        }
    });
}

export default {
    getCurrentGithubIntegration,
    getInstallationUrl,
    githubAppInstallationCallback,
    githubAppInstallationDeleted,
    githubAppUnifiedEvent
} 
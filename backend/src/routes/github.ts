import chalk from "chalk";
import { Request, Response } from "express";
import { db } from "../prismaClient";
import { User, GithubRepository, UserGithubRepository } from "../types/prisma";
import Owner from "../theOwner/Owner";
import { Commit, UnifiedGitHubEvent } from "../theOwner/utility";
import { search } from "../searchClient";
import { Session } from "../server";
import { ActivityOverview } from "../agent/agents/Analyzer";
import { TicketEventType } from "@prisma/client";
import { githubApp } from "../config/settings";
import { urls } from "../config/settings";
import { Repository, GithubAppInstallationCallbackRequest, GetGithubRepositoriesForIntegrationResponse } from "../shared/types";
import { GithubIntegrationManager } from "../integrations/GithubIntegration";
import { emitCacheInvalidationWithKey } from "../realtimeSocket";

// MARK: - Route Handlers

export async function getGithubIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const manager = new GithubIntegrationManager();
        const integrations = await manager.getInstancesForUser(req.session.user.id);
        res.status(200).json(integrations);
    } catch (error) {
        console.error('Error fetching GitHub integrations:', error);
        res.status(500).json({ error: 'Failed to fetch GitHub integrations' });
    }
}


/**
 * Get GitHub App installation URL
 */
export async function getInstallationUrl(req: Request, res: Response) {
    try {
        const appName = githubApp.appName;
        const clientId = githubApp.clientId;
        const state = Buffer.from(req.session?.user?.id).toString('base64');
        // Generate GitHub App installation URL with callback
        const installationUrl: string = `https://github.com/apps/${appName}/installations/new?client_id=${clientId}&target_type=repositories&state=${state}`;

        res.json({
            installationUrl
        });
    } catch (error) {
        console.error('Error generating installation URL:', error);
        res.status(500).json({ message: 'Failed to generate installation URL' });
    }
}

/**
 * Handle GitHub App installation callback from setup URL
 */
export async function processSetUpURLGithubInstallation(req: Request, res: Response) {
    const integration = new GithubIntegrationManager();
    await integration.processInstallationCallback(req, res);
}

/**
 * Handle GitHub App installation webhook callback
 */
export async function processsGithubAppInstallationWebhook(req: Request, res: Response) {
    const body: GithubAppInstallationCallbackRequest = req.body as GithubAppInstallationCallbackRequest;

    console.log('githubAppInstallationCallback', body);

    // Check if the user is registered with us, no problem if not. Will make a placeholder user.
    let user: User | null = await resolveUserForGithubInstallation(body.installationId, body.username);
    if (!user) {
        user = await db().users.create({
            data: {
                github_username: body.username,
                is_placeholder: true,
                email: body.email || `${body.username}@username.ai`,
                display_name: body.name || body.username
            }
        });

        console.log(chalk.green('Placeholder user created:'), user);
    }

    // Update the user_github_installation record with the user_id and account_name
    const updateData: { user_id: string; account_name?: string | null } = {
        user_id: user.id
    };
    if (body.accountName !== undefined) {
        updateData.account_name = body.accountName;
    }
    
    const createData: { user_id: string; installation_id: number; account_name?: string | null } = {
        user_id: user.id,
        installation_id: body.installationId
    };
    if (body.accountName !== undefined) {
        createData.account_name = body.accountName;
    }
    
    await db().user_github_installation.upsert({
        where: { installation_id: body.installationId },
        update: updateData,
        create: createData
    });

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

    emitCacheInvalidationWithKey(user.id, 'integrations');
}

/**
 * Handle GitHub App installation deleted webhook
 */
export async function githubAppInstallationDeleted(req: Request, res: Response) {
    console.log('githubAppInstallationDeleted', req.body);
    const body: GithubAppInstallationDeletedRequest = req.body as GithubAppInstallationDeletedRequest;

    await db().$transaction(async (tx) => {
        // find all repos for this installation
        const repositories: GithubRepository[] = await tx.github_repositories.findMany({ where: { installation_id: body.installationId } });

        if (repositories.length === 0) {
            res.status(404).json({ message: 'No repositories found for this installation' });
            return;
        }

        // remove all associations for those repos
        await tx.user_github_repositories.deleteMany({ where: { github_repository_id: { in: repositories.map(repo => repo.id) } } });

        // now remove the installation + repositories
        await tx.github_repositories.deleteMany({ where: { installation_id: body.installationId } });
        await tx.user_github_installation.deleteMany({ where: { installation_id: body.installationId } });
    });

    // TODO: We need to invalidate Automations that were dependent on these repositories. This is a more general issue we don't account for yet.

    emitCacheInvalidationWithKey(body.username, 'integrations');

    res.status(200).json({ message: 'Repositories removed from user' });
}

/**
 * Handle unified GitHub event webhook
 */
export async function githubAppUnifiedEvent(req: Request, res: Response) {
    const body: GithubAppUnifiedEventRequest = req.body as GithubAppUnifiedEventRequest;

    const { username, repositoryName, installationId } = body;
    console.log(chalk.blue('githubAppUnifiedEvent'), body.eventType, body.repositoryName, body.username);

    // Process event through integration manager
    const githubIntegrationManager = new GithubIntegrationManager();
    await githubIntegrationManager.processWebhookEvent(body).catch((error) => {
        console.error(chalk.red('Error processing GitHub event in integration manager:'), error);
    });

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
        const repository: GithubRepository = await resolveUserGithubRelation(user, username, repositoryName, installationId);

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
        if (!summary) {
            res.status(200).json({ message: 'No summary generated. No action will be taken.' });
            return;
        }

        console.log(chalk.green('Saving activity event for changed items:'), summary);
        await saveActivityEvent(repository, body, summary, user.id);
        
        res.status(200).json({ message: 'GitHub event received and processed' });
    } catch (error) {
        console.error(chalk.red('Error processing GitHub event:'), error);
        res.status(500).json({ message: 'Error processing GitHub event', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}

/**
 * Get repositories for a GitHub integration by installation_id
 */
export async function getGithubRepositoriesForIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const user = req.session.user;
    const installationId = req.query.installation_id as string | undefined;

    if (!installationId) {
        res.status(400).json({ message: 'installation_id is required' });
        return;
    }

    const installationIdNumber = parseInt(installationId);
    if (isNaN(installationIdNumber)) {
        res.status(400).json({ message: 'installation_id must be a number' });
        return;
    }

    // Verify the installation belongs to the user
    const installation = await db().user_github_installation.findFirst({
        where: {
            installation_id: installationIdNumber,
            user_id: user.id
        }
    });

    if (!installation) {
        res.status(404).json({ message: 'Installation not found or does not belong to user' });
        return;
    }

    // Get repositories for this installation
    const repositories = await db().github_repositories.findMany({
        where: { installation_id: installationIdNumber }
    });

    const result: GetGithubRepositoriesForIntegrationResponse = {
        repositories: repositories.map(r => ({
            id: r.repository_id,
            name: r.name,
            owner: r.owner
        }))
    };
    
    res.status(200).json(result);
}

// MARK: - Helper Functions

/**
 * Process a repository and associate it with a user
 */
export async function processRepository(
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
            repository_id: Number(repositoryData.id),
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
                    installation_id: installationId,
                    repository_id: Number(repositoryData.id),
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

/**
 * Resolve user for GitHub installation
 */
export async function resolveUserForGithubInstallation(installationId: number, github_username: string): Promise<User | null> {
    return db().$transaction(async (tx) => {
        // check if installation is already associated with a user - This should be most common case.
        let installation = await tx.user_github_installation.findFirst({ where: { installation_id: installationId } });
        if (installation && installation.user_id != null) {
            return tx.users.findUnique({ where: { id: installation.user_id } });
        }

        // check if we can match via github_username
        let user = await tx.users.findFirst({ where: { github_username: github_username } });
        if (user) {
            return user;
        }

        return null;
    });
}

/**
 * Resolve user GitHub relation and create repository if needed
 */
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

/**
 * Save activity event for GitHub event
 */
async function saveActivityEvent(repository: GithubRepository, event: UnifiedGitHubEvent, summary: ActivityOverview, userId: string) {
    const githubActivityEvent = await db().activity_events.create({
        data: {
            user_id: userId,
            event_type: event.eventType === 'push' ? 'PUSH' : event.eventType === 'pull_request.opened' ? 'PULL_REQUEST_OPENED' : event.eventType === 'pull_request.synchronize' ? 'PULL_REQUEST_UPDATED' : event.eventType === 'pull_request.merged' ? 'PULL_REQUEST_MERGED' : event.eventType === 'pull_request.closed' ? 'PULL_REQUEST_CLOSED' : 'PUSH',
            title: summary.summary,
            github_repository_id: repository.id
        }
    });

    // save sub activity events
    for (const subActivityOverview of summary.sub_activity_overviews) {
        const subActivityEvent = await db().sub_activity_events.create({
            data: {
                summary: subActivityOverview.summary,
                activity_event_id: githubActivityEvent.id
            }
        });

        // save sub activity commit associations
        for (const subActivityCommitAssociation of subActivityOverview.sub_activity_commit_associations) {  
            await db().sub_activity_commit_associations.create({
                data: {
                    sub_activity_event_id: subActivityEvent.id,
                    commit_sha: subActivityCommitAssociation.sha,
                    commit_message: subActivityCommitAssociation.message,
                    commit_url: subActivityCommitAssociation.url,   
                }
            });
        }
    }

    for (const projectActivityEvent of summary.project_activity_events) {
        await db().project_activity_events.create({
            data: {
                project_id: projectActivityEvent.project.id,
                activity_event_id: githubActivityEvent.id,
                title: projectActivityEvent.title,
                user_id: userId
            }
        });
    }

    for (const ticketActivityEvent of summary.ticket_activity_events) {
        await db().ticket_activity_events.create({
            data: {
                ticket_id: ticketActivityEvent.ticket.id,
                activity_event_id: githubActivityEvent.id,
                title: ticketActivityEvent.title,
                user_id: userId,
                event_type: 'TICKET_CREATED' as TicketEventType
            }
        });
    }
}

// MARK: - Types

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

type GithubAppInstallationDeletedRequest = {
    username: string;
    installationId: number;
}


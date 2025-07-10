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
    repositoryName: string;
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

    // check if repository exists
    const repository: GithubRepository | null = await db().github_repositories.findFirst({ where: { name: body.repositoryName, owner: body.username, installation_id: body.installationId } });
    console.log(chalk.green('Repository found:'), repository);

    // check if this user <-> repository is already associated
    const userRepository = await db().user_github_repositories.findFirst({ where: { user_id: user.id, github_repository_id: body.repositoryName } });

    if (userRepository) {
        console.log(chalk.red('User already associated with this repository'));
        res.status(400).json({ message: 'User already associated with this repository' });
        return;
    }

    console.log(chalk.green('User repository found:'), userRepository);

    try {
        // create the repository
        const repository: GithubRepository = await db().github_repositories.create({
            data: {
                name: body.repositoryName,
                owner: body.username,
                installation_id: body.installationId
            }
        });

        // associate the user with the repository
        await db().user_github_repositories.create({
            data: {
                user_id: user.id,
                github_repository_id: repository.id
            }
        });

        res.status(200).json({ message: 'Repository associated with user' });
    } catch (error) {
        console.error(chalk.red('Error associating user with repository:'), error);
        res.status(500).json({ message: 'Failed to associate user with repository' });
    }
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
async function resolveUserGithubRelation(user: User, username: string, repositoryName: string, installationId: number): Promise<GithubRepository | null> {
    // check if the repository is in our DB
    let repository: GithubRepository | null = await db().github_repositories.findFirst({ where: { name: repositoryName, installation_id: installationId } });
    if (!repository) {
        console.log(chalk.yellow('Drift detected. This repository is not in our DB but it is a registered repository in the github app. Creating it...'));
        repository = await db().github_repositories.create({
            data: {
                name: repositoryName,
                owner: username,
                installation_id: installationId
            }
        });
    }

    // Make sure the user is associated with the repository
    let relation: UserGithubRepository | null = await db().user_github_repositories.findFirst({ where: { user_id: user.id, github_repository_id: repository.id } });
    if (!relation) {
        await db().user_github_repositories.create({
        data: {
            user_id: user.id,
            github_repository_id: repository.id
            }
        });
    }

    // get the user
    return repository;
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

    // get the user
    let user: User | null = await db().users.findFirst({ where: { github_username: username } });
    if (!user) {
        console.log(chalk.yellow('User not found, creating placeholder user'));
        user = await db().users.create({
            data: {
                github_username: username,
                is_placeholder: true,
                email: body.sender.email || '',
                display_name: body.sender.login
            }
        });
        console.log(chalk.green('Placeholder user created:'), user);
    }

    // resolve the user github relation
    const repository: GithubRepository | null = await resolveUserGithubRelation(user, username, repositoryName, installationId);

    const adapter: TicketManager | null = await getUserTicketManager(user.id);

    if (!adapter) {
        console.log(chalk.red('User does not have a ticket manager'));
        await saveActivityEvent(body, [], user.id);
        res.status(200).json({ message: 'User does not have a ticket manager> Registering event, but no action will be taken' });
        return;
    }

    const session: Session = {
        user: user,
        isUserInitiated: false,
        teamId: (await adapter.getTeams())[0].id,
        ticketManager: adapter,
    }

    // init an Owner
    const owner: Owner = new Owner(search(), session)
    // handle the unified event
    const changedItems = await owner.handleUnifiedGitHubEvent(body);
    console.log(chalk.green('Saving activity event for changed items:'), changedItems);
    await saveActivityEvent(body, changedItems, user.id);
    
    res.status(200).json({ message: 'GitHub event received and processed' });
}

async function saveActivityEvent(event: UnifiedGitHubEvent, changedItems: ChangedItem[], userId: string) {
    const githubActivityEvent = await db().activity_events.create({
        data: {
            user_id: userId,
            event_type: event.eventType === 'push' ? 'PUSH' : event.eventType === 'pull_request.opened' ? 'PULL_REQUEST_OPENED' : event.eventType === 'pull_request.synchronize' ? 'PULL_REQUEST_UPDATED' : event.eventType === 'pull_request.merged' ? 'PULL_REQUEST_MERGED' : event.eventType === 'pull_request.closed' ? 'PULL_REQUEST_CLOSED' : 'PUSH',
            title: formatTitleForEvent(event),
            github_repository_id: event.repository.name
        }
    });

    // create ticket activity events
    for (const changedItem of changedItems) {
        await db().ticket_activity_events.create({
            data: {
                user_id: userId,
                activity_event_id: githubActivityEvent.id,
                ticket_id: changedItem.id,
                event_type: changedItem.change_event_type === ChangeEventType.CREATED ? 'TICKET_CREATED' : 'TICKET_UPDATED',
                title: formatTitleForEvent(event)
            }
        });
    }
}

export default {
    getCurrentGithubIntegration,
    getInstallationUrl,
    githubAppInstallationCallback,
    githubAppInstallationDeleted,
    githubAppUnifiedEvent
} 
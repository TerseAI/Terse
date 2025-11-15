import chalk from "chalk";
import { Request, Response } from "express";
import { db } from "../../prismaClient";
import { User, GithubRepository, UserGithubRepository } from "../../types/prisma";
import Owner from "../../theOwner/Owner";
import { Commit, UnifiedGitHubEvent } from "../../theOwner/utility";
import { search } from "../../searchClient";
import { Session } from "../../server";
import { ActivityOverview } from "../../agent/agents/Analyzer";
import { TicketEventType } from "@prisma/client";
import { githubApp } from "../../config/settings";
import { Repository } from "../../shared/types";
import { processGithubEvent } from "./githubEventProcessor";

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
}

export async function githubAppUnifiedEvent(req: Request, res: Response) {
    const body: GithubAppUnifiedEventRequest = req.body as GithubAppUnifiedEventRequest;

    const { username, repositoryName, installationId } = body;
    console.log(chalk.blue('githubAppUnifiedEvent'), body.eventType, body.repositoryName, body.username);

    /// Go run this on the new code... anything below here is legacy code for Merkle use case.
    const results = await processGithubEvent(body);

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

export default {
    getCurrentGithubIntegration,
    getInstallationUrl,
    githubAppUnifiedEvent
} 
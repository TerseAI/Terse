import chalk from "chalk";
import { Request, Response } from "express";
import { db } from "../../prismaClient";
import { User, GithubRepository, UserGithubRepository } from "../../types/prisma";
import Owner from "../../theOwner/Owner";
import { Commit, GithubAppUnifiedEventRequest } from "../../routes/GithubTypes";
import { search } from "../../searchClient";
import { Session } from "../../server";
import { ActivityOverview } from "../../agent/agents/Analyzer";
import { TicketEventType } from "@prisma/client";
import { githubApp } from "../../config/settings";
import { Repository } from "../../shared/types";
import { processGithubEvent } from "./githubEventProcessor";
import logger from "../../logger";

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
        logger.error('Error generating installation URL:', { error });
        res.status(500).json({ message: 'Failed to generate installation URL' });
    }
}

export async function processRepository(
    repositoryData: Repository, 
    user: User, 
    installationId: number
): Promise<{ name: string; status: string; error?: string }> {
    logger.info('Processing repository', { repository: repositoryData });

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
            logger.debug('User already associated with repository', { repositoryName: repositoryData.name });
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
            logger.info('Repository created', { repositoryId: repository.id, repositoryName: repository.name });
        }

        // Associate the user with the repository
        await db().user_github_repositories.create({
            data: {
                user_id: user.id,
                github_repository_id: repository.id
            }
        });

        logger.info('User associated with repository', { repositoryName: repositoryData.name, userId: user.id });
        return { name: repositoryData.name, status: 'associated' };

    } catch (error) {
        logger.error('Error processing repository', { repositoryName: repositoryData.name, error });
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

    logger.info('githubAppRecievedCommit', { body });

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
            logger.warn('Drift detected. This repository is not in our DB but it is a registered repository in the github app. Creating it...', { repositoryName, installationId });
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

export async function githubAppUnifiedEvent(req: Request, res: Response) {
    const body: GithubAppUnifiedEventRequest = req.body as GithubAppUnifiedEventRequest;

    const { username, repositoryName, installationId } = body;
    logger.info('githubAppUnifiedEvent', { eventType: body.eventType, repositoryName: body.repositoryName, username: body.username });

    /// Go run this on the new code... anything below here is legacy code for Merkle use case.
    const results = await processGithubEvent(body);

    try {
        // get the user with transaction safety
        let user: User | null = await db().$transaction(async (tx) => {
            let foundUser = await tx.users.findFirst({ where: { github_username: username } });
            if (!foundUser) {
                const email = username + '@username.ai';
                logger.info('User not found, creating placeholder user with fake email', { email, githubUsername: username });
                foundUser = await tx.users.create({
                    data: {
                        github_username: username,
                        is_placeholder: true,
                        email: email,
                        display_name: body.sender.login
                    }
                });
                logger.info('Placeholder user created', { userId: foundUser.id, githubUsername: foundUser.github_username, email: foundUser.email });
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

        logger.info('Processing event for user', { githubUsername: user.github_username, teamId: session.teamId });

        // init an Owner with isolated session
        const owner: Owner = new Owner(search(), session)
        
        // handle the unified event with proper error handling
        const summary = await owner.handleUnifiedGitHubEvent(body);
        if (!summary) {
            res.status(200).json({ message: 'No summary generated. No action will be taken.' });
            return;
        }

        logger.info('Saving activity event for changed items', { summary });
        await saveActivityEvent(repository, body, summary, user.id);
        
        res.status(200).json({ message: 'GitHub event received and processed' });
    } catch (error) {
        logger.error('Error processing GitHub event', { error });
        res.status(500).json({ message: 'Error processing GitHub event', error: error instanceof Error ? error.message : 'Unknown error' });
    }
}

async function saveActivityEvent(repository: GithubRepository, event: GithubAppUnifiedEventRequest, summary: ActivityOverview, userId: string) {
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
    getInstallationUrl,
    githubAppUnifiedEvent
} 
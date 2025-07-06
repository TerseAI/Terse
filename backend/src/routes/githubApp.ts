import chalk from "chalk";
import { Request, Response } from "express";
import { db } from "src/prismaClient";
import { User, GithubRepository } from "../types/prisma";
import Owner, { Commit } from "src/theOwner/Owner";
import { LinearAdapter } from "src/ticketing/linear";
import { PostgreSQLSearch } from "src/search/SearchProvider";
import { EmbeddingSystem } from "src/search/EmbeddingSystem";
import { search } from "src/searchClient";
import { Session } from "src/server";
import { TicketManager } from "src/ticketing/TicketIntegration";

const GITHUB_APP_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Get GitHub App installation URL
export async function getInstallationUrl(req: Request, res: Response) {
    try {
        // Generate GitHub App installation URL with callback
        const installationUrl = `https://github.com/apps/vectra-github/installations/new?client_id=${GITHUB_APP_CLIENT_ID}&state=vectra&target_type=repositories`;

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
    const body = req.body as GithubAppInstallationCallbackRequest;

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
        const repository = await db().github_repositories.create({
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
    const body = req.body as GithubAppInstallationDeletedRequest;

    // find all repos for this installation
    const repositories = await db().github_repositories.findMany({ where: { installation_id: body.installationId } });

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
    const repository = await db().github_repositories.findFirst({ where: { name: body.repositoryName, owner: body.username, installation_id: body.installationId } });

    if (!repository) {
        res.status(404).json({ message: 'Repository not found' });
        return;
    }
}

type GithubAppRecievedPushRequest = {
    username: string;
    installationId: number;
    repositoryName: string;
    branch: string;
    commits: Commit[];
}

export async function githubAppRecievedPush(req: Request, res: Response) {
    const body = req.body as GithubAppRecievedPushRequest;

    console.log('githubAppRecievedPush', body);

    // get the repository
    const repository = await db().github_repositories.findFirst({ where: { name: body.repositoryName, owner: body.username, installation_id: body.installationId } });

    if (!repository) {
        console.log(chalk.red('Repository not found'));
        res.status(404).json({ message: 'Repository not found' });
        return;
    }

    // get the user
    const user = await db().users.findFirst({ where: { github_username: body.username } });

    if (!user) {
        console.log(chalk.red('User not found'));
        res.status(404).json({ message: 'User not found' });
        return;
    }

    // make sure this user is associated with this repository
    const userRepository = await db().user_github_repositories.findFirst({ where: { user_id: user.id, github_repository_id: repository.id } });

    if (!userRepository) {
        console.log(chalk.red('User not associated with this repository'));
        res.status(404).json({ message: 'User not associated with this repository' });
        return;
    }

    // check if user has a linear API Key
    const linearApiKey = await db().linear_api_keys.findFirst({ where: { user_id: user.id } });

    if (!linearApiKey) {
        console.log(chalk.red('User does not have a linear API Key'));
        res.status(404).json({ message: 'User does not have a linear API Key' });
        return;
    }

    let adapter: TicketManager = new LinearAdapter(linearApiKey.api_key);
    let session: Session = {
        user: user,
        isUserInitiated: false,
        teamId: (await adapter.getTeams())[0].id,
        ticketManager: adapter,
    }

    // init an Owner
    const owner = new Owner(new LinearAdapter(linearApiKey.api_key), search(), session)

    // handle the push event
    await owner.handlePushEvent({
        username: body.username,
        installationId: body.installationId,
        repositoryName: body.repositoryName,
        branch: body.branch,
        commits: body.commits
    });
    
    res.status(200).json({ message: 'Push event received and processed' });
}


type GithubAppRecievedPullRequestRequest = {
    username: string;
    installationId: number;
    repositoryName: string;
}

export async function githubAppRecievedPullRequest(req: Request, res: Response) {
    const body = req.body as GithubAppRecievedPullRequestRequest;
}

type GithubAppNewBranch = {
    username: string;
    installationId: number;
    repositoryName: string;
}

export async function githubAppRecievedIssueComment(req: Request, res: Response) {
    const body = req.body as GithubAppNewBranch;
}

export default {
    getInstallationUrl
}; 
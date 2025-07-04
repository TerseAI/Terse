import { Request, Response } from "express";
import { db } from "src/prismaClient";

const GITHUB_APP_CLIENT_ID = process.env.GITHUB_CLIENT_ID

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
    username: string;
    installationId: number;
    repositoryName: string;
}

export async function githubAppInstallationCallback(req: Request, res: Response) {
    const body = req.body as GithubAppInstallationCallbackRequest;

    console.log('githubAppInstallationCallback', body);

    // associate the user.
    const user = await db().users.findUnique({ where: { github_username: body.username } });

    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    // check if this user <-> repository is already associated
    const userRepository = await db().user_github_repositories.findFirst({ where: { user_id: user.id, github_repository_id: body.repositoryName } });

    if (userRepository) {
        res.status(400).json({ message: 'User already associated with this repository' });
        return;
    }

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
}

export async function githubAppRecievedPush(req: Request, res: Response) {
    const body = req.body as GithubAppRecievedPushRequest;
}

export async function githubAppRecievedPullRequest(req: Request, res: Response) {
    const body = req.body as GithubAppRecievedPullRequestRequest;
}

type GithubAppRecievedPullRequestRequest = {
    username: string;
    installationId: number;
    repositoryName: string;
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
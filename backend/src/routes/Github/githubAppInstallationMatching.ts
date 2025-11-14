import { Request, Response } from "express";
import { db } from "../../prismaClient";
import { GithubRepository, User } from "../../types/prisma";
import { GithubAppInstallationCallbackRequest } from "../../shared/types";
import chalk from "chalk";
import { processRepository } from "./githubApp";

export async function processSetUpURLGithubInstallation(req: Request, res: Response) {
    const { installation_id, setup_action, state } = req.query;

    console.log("installation_id", installation_id);
    console.log("setup_action", setup_action);
    console.log("state", state);

    res.status(200).json({ message: 'GitHub frontend installation callback processed' });
}

export async function processsGithubAppInstallationWebhook(req: Request, res: Response) {
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
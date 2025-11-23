import { GithubAppUnifiedEventRequest } from "../GithubTypes";
import chalk from "chalk";
import { resolveUserForGithubInstallation } from "./githubAppInstallationMatching";
import { User } from "../../types/prisma";
import { EventProcessor } from "../../agent/ChannelAgent/EventProcessor";
import { GithubEvent } from "../../integrations/GithubIntegration";
import { db } from "../../prismaClient";
import { Request, Response } from "express";
import { GetGithubRepositoriesForIntegrationResponse } from "../../shared/types";

export async function processGithubEvent(event: GithubAppUnifiedEventRequest) {
    console.log(chalk.blue('processGithubEvent'), event);

    const user: User | null = await resolveUserForGithubInstallation(event.installationId, event.username);

    if (!user) {
        return null;
    }

    const githubEvent = new GithubEvent(event);
    const eventProcessor = new EventProcessor(githubEvent, user);
    const results = await eventProcessor.process();

    return results;
}

export async function getGithubRepositoriesForIntegration(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const user = req.session.user;
    const repositories = await db().user_github_repositories.findMany({ where: { user_id: user.id }, include: { github_repository: true } });

    const result: GetGithubRepositoriesForIntegrationResponse = {
        repositories: repositories.map(r => ({
            id: r.github_repository.repository_id,
            name: r.github_repository.name,
            owner: r.github_repository.owner
        }))
    };
    
    res.status(200).json(result);
}
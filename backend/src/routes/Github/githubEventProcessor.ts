import { Request, Response } from "express";
import { EventProcessor } from "../../agent/AgentRunner/EventProcessor";
import { GithubEvent } from "../../integrations/GithubIntegration";
import logger from "../../logger";
import { db } from "../../prismaClient";
import {
  GetGithubRepositoriesForIntegrationResponse,
  User,
} from "../../shared/types";
import { GithubAppUnifiedEventRequest } from "../GithubTypes";
import { resolveUserForGithubInstallation } from "../github";

export async function processGithubEvent(event: GithubAppUnifiedEventRequest) {
  logger.info("processGithubEvent", { event });

  const user: User | null = await resolveUserForGithubInstallation(
    event.installationId,
    event.username,
  );

  if (!user) {
    return null;
  }

  const githubEvent = new GithubEvent(event);
  const eventProcessor = new EventProcessor(githubEvent, user);
  const results = await eventProcessor.process();

  return results;
}

export async function getGithubRepositoriesForIntegration(
  req: Request,
  res: Response,
) {
  if (!req.session?.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const user = req.session.user;
  const repositories = await db().user_github_repositories.findMany({
    where: { user_id: user.id },
    include: { github_repository: true },
  });

  const result: GetGithubRepositoriesForIntegrationResponse = {
    repositories: repositories.map((r) => ({
      id: r.github_repository.repository_id,
      name: r.github_repository.name,
      owner: r.github_repository.owner,
    })),
  };

  res.status(200).json(result);
}

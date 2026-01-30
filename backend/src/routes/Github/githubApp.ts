import { Request, Response } from "express";
import { githubApp } from "../../config/settings";
import logger from "../../logger";
import { db } from "../../prismaClient";
import { GithubAppUnifiedEventRequest } from "../../routes/GithubTypes";
import { Repository } from "../../shared/types";
import { GithubRepository, User } from "../../types/prisma";
import { processGithubEvent } from "./githubEventProcessor";

// Get GitHub App installation URL
export async function getInstallationUrl(req: Request, res: Response) {
  try {
    const appName = githubApp.appName;
    const clientId = githubApp.clientId;
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const state = Buffer.from(userId).toString("base64");
    // Generate GitHub App installation URL with callback
    const installationUrl: string = `https://github.com/apps/${appName}/installations/new?client_id=${clientId}&target_type=repositories&state=${state}`;

    res.json({
      installationUrl,
    });
  } catch (error) {
    logger.error("Error generating installation URL:", { error });
    res.status(500).json({ message: "Failed to generate installation URL" });
  }
}

export async function processRepository(
  repositoryData: Repository,
  user: User,
  installationId: number,
): Promise<{ name: string; status: string; error?: string }> {
  logger.info("Processing repository", { repository: repositoryData });

  // Check if repository already exists
  let repository: GithubRepository | null =
    await db().github_repositories.findFirst({
      where: {
        name: repositoryData.name,
        owner: repositoryData.owner,
        repository_id: Number(repositoryData.id),
        installation_id: installationId,
      },
    });

  // Check if this user <-> repository is already associated
  if (repository) {
    const userRepository = await db().user_github_repositories.findFirst({
      where: {
        user_id: user.id,
        github_repository_id: repository.id,
      },
    });

    if (userRepository) {
      logger.debug("User already associated with repository", {
        repositoryName: repositoryData.name,
      });
      return { name: repositoryData.name, status: "already_associated" };
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
        },
      });
      logger.info("Repository created", {
        repositoryId: repository.id,
        repositoryName: repository.name,
      });
    }

    // Associate the user with the repository
    await db().user_github_repositories.create({
      data: {
        user_id: user.id,
        github_repository_id: repository.id,
      },
    });

    logger.info("User associated with repository", {
      repositoryName: repositoryData.name,
      userId: user.id,
    });
    return { name: repositoryData.name, status: "associated" };
  } catch (error) {
    logger.error("Error processing repository", {
      repositoryName: repositoryData.name,
      error,
    });
    return {
      name: repositoryData.name,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function githubAppUnifiedEvent(req: Request, res: Response) {
  const body: GithubAppUnifiedEventRequest =
    req.body as GithubAppUnifiedEventRequest;
  logger.info("githubAppUnifiedEvent", {
    eventType: body.eventType,
    repositoryName: body.repositoryName,
    username: body.username,
  });

  try {
    await processGithubEvent(body);
    res.status(200).json({ message: "Event processed successfully" });
  } catch (error) {
    logger.error("Error processing GitHub event", {
      error,
      eventType: body.eventType,
      repositoryName: body.repositoryName,
      username: body.username,
    });
    res.status(500).json({ error: "Failed to process GitHub event" });
  }
}

export default {
  getInstallationUrl,
  githubAppUnifiedEvent,
};

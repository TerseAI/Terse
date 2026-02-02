import { Request, Response } from "express";
import { githubApp } from "../config/settings";
import {
  getAppInstallationsForUser,
  getAppInstallationRepositories,
  GithubIntegrationManager,
} from "../integrations/GithubIntegration";
import logger from "../logger";
import { db } from "../prismaClient";
import { emitCacheInvalidationWithKey } from "../services/CacheInvalidationService";
import {
  GithubAppInstallationDeletedRequest,
  GithubAppInstallationRepository,
  GithubAppUnifiedEventRequest,
} from "../routes/GithubTypes";
import {
  GetGithubRepositoriesForIntegrationResponse,
  GithubAppInstallationCallbackRequest,
  Repository,
  User as RuntimeUser,
} from "../shared/types";
import { getUserForOrg } from "../utility/workos";
import { GithubRepository } from "../types/prisma";

// MARK: - Route Handlers

export async function getGithubIntegrations(req: Request, res: Response) {
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const manager = new GithubIntegrationManager();
    const integrations = await manager.getInstancesForOrganization(
      req.session.user.organizationId,
    );
    res.status(200).json(integrations);
  } catch (error) {
    logger.error("Error fetching GitHub integrations", { error });
    res.status(500).json({ error: "Failed to fetch GitHub integrations" });
  }
}

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
    logger.error("Error generating installation URL", { error });
    res.status(500).json({ message: "Failed to generate installation URL" });
  }
}

export async function processsGithubAppInstallationWebhook(
  req: Request,
  res: Response,
) {
  const body: GithubAppInstallationCallbackRequest =
    req.body as GithubAppInstallationCallbackRequest;
  logger.debug("githubAppInstallationCallback", {
    installationId: body.installationId,
    username: body.username,
  });

  try {
    const user: RuntimeUser | null = await resolveUserForGithubInstallation(
      body.installationId,
      body.username,
    );
    if (user?.organizationId) {
      emitCacheInvalidationWithKey(user.organizationId, "integrations");
    }
    res.status(200).json({ message: "Installation webhook processed" });
  } catch (error) {
    logger.error("Error processing GitHub installation webhook", {
      error,
      installationId: body.installationId,
      username: body.username,
    });
    res.status(500).json({ error: "Failed to process installation webhook" });
  }
}

export async function githubAppInstallationDeleted(
  req: Request,
  res: Response,
) {
  const body: GithubAppInstallationDeletedRequest =
    req.body as GithubAppInstallationDeletedRequest;
  logger.debug("githubAppInstallationDeleted", {
    installationId: body.installationId,
    username: body.username,
  });

  // Look up organizationId before deletion (installation record will be removed in transaction)
  const installation = await db().user_github_installation.findUnique({
    where: { installation_id: body.installationId },
    select: { user_id: true },
  });
  let organizationId: string | null = null;
  if (installation?.user_id) {
    const token = await db().github_app_tokens.findFirst({
      where: { user_id: installation.user_id },
      select: { organization_id: true },
    });
    organizationId = token?.organization_id ?? null;
  }

  await db().$transaction(async (tx) => {
    // find all repos for this installation
    const repositories: GithubRepository[] =
      await tx.github_repositories.findMany({
        where: { installation_id: body.installationId },
      });

    if (repositories.length === 0) {
      res
        .status(404)
        .json({ message: "No repositories found for this installation" });
      return;
    }

    // remove all associations for those repos
    await tx.user_github_repositories.deleteMany({
      where: {
        github_repository_id: { in: repositories.map((repo) => repo.id) },
      },
    });

    // now remove the installation + repositories
    await tx.github_repositories.deleteMany({
      where: { installation_id: body.installationId },
    });
    await tx.user_github_installation.deleteMany({
      where: { installation_id: body.installationId },
    });
    res.status(200).json({ message: "Repositories removed from user" });
  });

  // TODO: We need to invalidate Channels that were dependent on these repositories. This is a more general issue we don't account for yet.

  if (organizationId) {
    emitCacheInvalidationWithKey(organizationId, "integrations");
  }
}

/**
 * Handle unified GitHub event webhook
 */
export async function githubAppUnifiedEvent(req: Request, res: Response) {
  const body: GithubAppUnifiedEventRequest =
    req.body as GithubAppUnifiedEventRequest;

  const { username, repositoryName } = body;
  logger.info("githubAppUnifiedEvent", {
    eventType: body.eventType,
    repositoryName: body.repositoryName,
    username: body.username,
  });

  try {
    // Process event through integration manager
    const githubIntegrationManager = new GithubIntegrationManager();
    await githubIntegrationManager.processWebhookEvent(body);
    res.status(200).json({ message: "Event processed successfully" });
  } catch (error) {
    logger.error("Error processing GitHub event in integration manager", {
      error,
      eventType: body.eventType,
      repositoryName,
      username,
    });
    res.status(500).json({ error: "Failed to process GitHub event" });
  }
}

type RouteError = Error & { statusCode?: number };

function createRouteError(message: string, statusCode: number): RouteError {
  const error = new Error(message) as RouteError;
  error.statusCode = statusCode;
  return error;
}

export async function fetchGithubRepositoriesForIntegration(
  organizationId: string,
  installationId: string,
): Promise<GetGithubRepositoriesForIntegrationResponse> {
  if (!installationId) {
    throw createRouteError("Installation ID is required", 400);
  }
  if (!organizationId) {
    throw createRouteError("Organization context is required", 400);
  }

  // Find a token in the org that has access to this installation
  const orgTokens = await db().github_app_tokens.findMany({
    where: { organization_id: organizationId },
  });
  if (orgTokens.length === 0) {
    throw createRouteError("Unauthorized", 401);
  }

  let targetInstallation: { id: number } | undefined;
  let tokenWithAccess: (typeof orgTokens)[0] | null = null;

  for (const token of orgTokens) {
    const installations = await getAppInstallationsForUser(token.access_token);
    const installation = installations.installations.find(
      (i) => i.id === Number(installationId),
    );
    if (installation) {
      targetInstallation = installation;
      tokenWithAccess = token;
      break;
    }
  }

  if (!targetInstallation || !tokenWithAccess) {
    throw createRouteError("Installation not found", 404);
  }

  const installationRepositories: GithubAppInstallationRepository[] =
    await getAppInstallationRepositories(
      tokenWithAccess.access_token,
      targetInstallation.id,
    );

  return {
    repositories: installationRepositories.map((r) => ({
      id: r.id,
      name: r.name,
      owner: r.owner.login,
    })),
  };
}

export async function getGithubRepositoriesForIntegration(
  req: Request,
  res: Response,
) {
  if (!req.session?.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const installationId = req.query.installation_id as string;

  try {
    if (!req.session.user.organizationId) {
      return res.status(400).json({ message: "Organization context is required" });
    }
    const result = await fetchGithubRepositoriesForIntegration(
      req.session.user.organizationId,
      installationId,
    );
    res.status(200).json(result);
  } catch (error) {
    const routeError = error as RouteError;
    res
      .status(routeError.statusCode || 500)
      .json({ message: routeError.message || "Failed to fetch repositories" });
  }
}

export async function processRepository(
  repositoryData: Repository,
  user: RuntimeUser,
  installationId: number,
): Promise<{ name: string; status: string; error?: string }> {
  logger.debug("Processing repository", {
    repositoryName: repositoryData.name,
    owner: repositoryData.owner,
    installationId,
    userId: user.id,
  });

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
        userId: user.id,
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
        installationId,
      });
    }

    // Associate the user with the repository
    await db().user_github_repositories.create({
      data: {
        user_id: user.id,
        github_repository_id: repository.id,
      },
    });

    // associate the user with the installation
    await db().user_github_installation.upsert({
      where: { installation_id: installationId },
      update: { user_id: user.id },
      create: { user_id: user.id, installation_id: installationId },
    });

    logger.info("User associated with repository", {
      repositoryName: repositoryData.name,
      userId: user.id,
      repositoryId: repository.id,
    });
    return { name: repositoryData.name, status: "associated" };
  } catch (error) {
    logger.error("Error processing repository", {
      error,
      repositoryName: repositoryData.name,
      userId: user.id,
      installationId,
    });
    return {
      name: repositoryData.name,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Given an installation and username, resolve a specific user (runtime User type)
export async function resolveUserForGithubInstallation(
  installationId: number,
  username: string,
): Promise<RuntimeUser | null> {
  const usersFromInstallation = await resolveUsersForGithubInstallation(
    installationId,
  );
  const installationUserIds = usersFromInstallation.map((u) => u.id);

  // Match by github_username in github_app_tokens (users table no longer has github_username)
  const tokenForUsername = await db().github_app_tokens.findFirst({
    where: {
      github_username: username,
      user_id: { in: installationUserIds },
    },
  });
  if (tokenForUsername?.organization_id) {
    const user = await getUserForOrg(
      tokenForUsername.user_id,
      tokenForUsername.organization_id,
    );
    if (user) return user;
  }

  // User might have token but not be in installation list yet (e.g. new install)
  const anyTokenForUsername = await db().github_app_tokens.findFirst({
    where: { github_username: username },
  });
  if (
    anyTokenForUsername?.organization_id &&
    installationUserIds.includes(anyTokenForUsername.user_id)
  ) {
    const user = await getUserForOrg(
      anyTokenForUsername.user_id,
      anyTokenForUsername.organization_id,
    );
    if (user) return user;
  }

  return null;
}

// Given an installation, we need to fetch all users that are associated with that installation.
// This doesn't guarantee that they have an active input config, but it's a good start.
// This is super inefficient, but it's a good start. We need to optimize this.
export async function resolveUsersForGithubInstallation(
  installationId: number,
): Promise<import("../types/prisma").User[]> {
  return db().$transaction(async (tx) => {
    // Get all of our github app users.
    const githubAppUsers = await tx.github_app_tokens.findMany();

    // for each github App user, get their installations they have access to. Return a Map<user_id, installations>
    const installationResults = await Promise.all(
      githubAppUsers.map(async (user) => {
        const installations = await getAppInstallationsForUser(
          user.access_token,
        );
        return {
          userId: user.user_id,
          installations: installations.installations,
        };
      }),
    );

    // Find users who have access to the specific installation
    const userIds = installationResults
      .filter((result) =>
        result.installations.some((inst) => inst.id === installationId),
      )
      .map((result) => result.userId);

    // Fetch and return the User objects
    const users = await tx.users.findMany({
      where: { id: { in: userIds } },
    });

    logger.debug(`Found ${users.length} users for event from installation`, {
      installationId,
      userCount: users.length,
    });

    return users;
  });
}

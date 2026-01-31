import { Request, Response } from "express";
import logger from "../../logger";
import { db } from "../../prismaClient";
import { emitCacheInvalidationWithKey } from "../../realtimeSocket";
//import { GithubAppInstallationCallbackRequest } from "../../shared/types";
import { GithubRepository } from "../../types/prisma";
//import { processRepository } from "./githubApp";

// TODO: find solution for this
// export async function processsGithubAppInstallationWebhook(
//   req: Request,
//   res: Response,
// ) {
//   const body: GithubAppInstallationCallbackRequest =
//     req.body as GithubAppInstallationCallbackRequest;

//   // Check if the user is regestered with us, no problem if not. Will make a placeholder user.
//   let user: User | null = await resolveUserForGithubInstallation(
//     body.installationId,
//     body.username,
//   );

//   // Update the user_github_installation record with the user_id
//   await db().user_github_installation.upsert({
//     where: { installation_id: body.installationId },
//     update: { user_id: user.id },
//     create: { user_id: user.id, installation_id: body.installationId },
//   });

//   // Process each repository in the array
//   const processedRepositories = await Promise.all(
//     body.repositories.map((repositoryData) =>
//       processRepository(repositoryData, user, body.installationId),
//     ),
//   );

//   res.status(200).json({
//     message: "Repository installation callback processed",
//     processedRepositories,
//   });

//   emitCacheInvalidationWithKey(user.id, "integrations");
// }

type GithubAppInstallationDeletedRequest = {
  username: string;
  installationId: number;
};

export async function githubAppInstallationDeleted(
  req: Request,
  res: Response,
) {
  logger.info("githubAppInstallationDeleted", { body: req.body });
  const body: GithubAppInstallationDeletedRequest =
    req.body as GithubAppInstallationDeletedRequest;

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
  });

  // TODO: We need to invalidate Automations that were dependent on these repositories. This is a more general issue we don't account for yet.

  if (organizationId) {
    emitCacheInvalidationWithKey(organizationId, "integrations");
  }

  res.status(200).json({ message: "Repositories removed from user" });
}

// export async function resolveUserForGithubInstallation(
//   installationId: number,
//   github_username: string,
// ): Promise<User | null> {
//   return db().$transaction(async (tx) => {
//     // check if installation is already associated with a user - This should be most common case.
//     let installation = await tx.user_github_installation.findFirst({
//       where: { installation_id: installationId },
//     });
//     if (installation && installation.user_id != null) {
//       return tx.users.findUnique({ where: { id: installation.user_id } });
//     }

//     // check if we can match via github_username
//     let user = await tx.users.findFirst({
//       where: { github_username: github_username },
//     });
//     if (user) {
//       return user;
//     }

//     return null;
//   });
// }

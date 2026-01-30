import logger from "../logger";
import { db } from "../prismaClient";
import { User } from "./prisma";

export async function findUserByEmail(email: string): Promise<User | null> {
  const user = await db().users.findUnique({ where: { email } });
  return user || null;
}

export async function findUserByGitHubUsername(
  githubUsername: string,
): Promise<User | null> {
  const user = await db().users.findUnique({
    where: { github_username: githubUsername },
  });
  return user || null;
}

export async function createUser(
  displayName: string,
  email: string,
  githubUsername: string | null,
): Promise<User> {
  let user = await db().users.create({
    data: {
      display_name: displayName,
      email,
      github_username: githubUsername,
    },
  });

  logger.info("✅ New user created", {
    email: user.email,
    userId: user.id,
    displayName: user.displayName,
    githubUsername: user.github_username,
  });

  return user;
}

export async function updateUserGitHubUsername(
  userId: string,
  githubUsername: string,
): Promise<User> {
  const user = await db().users.update({
    where: { id: userId },
    data: { github_username: githubUsername },
  });

  logger.info("✅ Updated GitHub username for user", {
    email: user.email,
    userId: user.id,
    githubUsername,
  });

  return user;
}

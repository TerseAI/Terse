import logger from "../logger";
import { db } from "../prismaClient";
import { User } from "./prisma";

export async function login(
  email: string,
  password: string,
): Promise<User | null> {
  try {
    const user: User | null = await findUserByEmail(email);
    if (!user) {
      logger.warn("❌ User not found. Unable to login", { email });
      return null;
    }

    logger.info("✅ Login successful", { email, userId: user.id });
    return user;
  } catch (error) {
    logger.error("❌ Login error", { error, email });
    return null;
  }
}

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

export async function findUserById(id: string): Promise<User | null> {
  const user = await db().users.findUnique({ where: { id } });
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
    displayName: user.display_name,
    githubUsername: user.github_username,
  });

  return user;
}

export async function getOrCreateUserForImport(
  email: string,
  displayName?: string,
): Promise<User> {
  // First try to find existing user
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return existingUser;
  }

  // If not found, create placeholder user
  return await createPlaceholderUser(email, displayName);
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

export async function createPlaceholderUser(
  email: string,
  displayName?: string,
): Promise<User> {
  // Check if user already exists
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return existingUser;
  }

  const user = await db().users.create({
    data: {
      email,
      display_name: displayName || email.split("@")[0],
      // is_placeholder: true,
    },
  });

  logger.info("📝 Placeholder user created for import", {
    email: user.email,
    userId: user.id,
    displayName: user.display_name,
  });

  return user;
}

import { db } from "../prismaClient";
import { LinearApiKey, JiraApiKey, User } from "./prisma";
import chalk from "chalk";
import { TicketManager } from "../ticketing/TicketIntegration";
import { LinearAdapter } from "../ticketing/linear";
import { JiraAdapter } from "../ticketing/jira";

export async function login(email: string, password: string): Promise<User | null> {
  try {
    const user: User | null = await findUserByEmail(email);
    if (!user) {
      console.log(chalk.red("❌ User not found. Unable to login:"), chalk.cyan(email));
      return null;
    }

    console.log(chalk.green("✅ Login successful:"), chalk.cyan(email));
    return user;
  } catch (error) {
    console.error(chalk.red("❌ Login error:"), error);
    return null;
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const user = await db().users.findUnique({ where: { email } });
  return user || null;
}

export async function findUserByGitHubUsername(githubUsername: string): Promise<User | null> {
  const user = await db().users.findUnique({ where: { github_username: githubUsername } });
  return user || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const user = await db().users.findUnique({ where: { id } });
  return user || null;
}

export async function createUser(
  displayName: string,
  email: string,
  githubUsername: string | null
): Promise<User> {
  let user = await db().users.create({
    data: {
      display_name: displayName,
      email,
      github_username: githubUsername,
    },
  });

  console.log(chalk.green("✅ New user created:"), chalk.cyan(user.email));

  return user;
}

export async function getOrCreateUserForImport(email: string, displayName?: string): Promise<User> {
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
  githubUsername: string
): Promise<User> {
  const user = await db().users.update({
    where: { id: userId },
    data: { github_username: githubUsername },
  });

  console.log(
    chalk.green("✅ Updated GitHub username for user:"),
    chalk.cyan(user.email),
    chalk.yellow(githubUsername)
  );

  return user;
}

export async function createPlaceholderUser(email: string, displayName?: string): Promise<User> {
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

  console.log(chalk.yellow("📝 Placeholder user created for import:"), chalk.cyan(user.email));

  return user;
}

export async function getUserTicketManager(userId: string): Promise<TicketManager | null> {
  const user = await findUserById(userId);
  if (!user) {
    console.error(chalk.red.bold("❌ User not found in database. Unable to authenticate user."));
    return null;
  }

  // Try Linear first
  const linearApiKey: LinearApiKey | null = await db().linear_api_keys.findUnique({
    where: { user_id: user.id },
  });
  if (linearApiKey) {
    const linearApiKeyValid: boolean = await LinearAdapter.validateKey(linearApiKey.api_key);
    if (linearApiKeyValid) {
      return new LinearAdapter(linearApiKey.api_key);
    }
  }

  // Fallback to Jira
  const jiraApiKey: JiraApiKey | null = await db().jira_api_keys.findUnique({
    where: { user_id: user.id },
  });
  if (jiraApiKey) {
    const valid = await JiraAdapter.validateCredentials(
      jiraApiKey.base_url,
      jiraApiKey.jira_user_email,
      jiraApiKey.api_token
    );
    if (valid) {
      return new JiraAdapter({
        baseUrl: jiraApiKey.base_url,
        email: jiraApiKey.jira_user_email,
        apiToken: jiraApiKey.api_token,
      });
    }
  }

  console.error(chalk.red.bold("❌ No valid ticketing credentials found for user."));
  return null;
}

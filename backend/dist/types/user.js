import { db } from "src/prismaClient";
import chalk from "chalk";
import { LinearAdapter } from "src/ticketing/linear";
export async function login(email, password) {
    try {
        const user = await findUserByEmail(email);
        if (!user) {
            console.log(chalk.red('❌ User not found. Unable to login:'), chalk.cyan(email));
            return null;
        }
        console.log(chalk.green('✅ Login successful:'), chalk.cyan(email));
        return user;
    }
    catch (error) {
        console.error(chalk.red('❌ Login error:'), error);
        return null;
    }
}
export async function findUserByEmail(email) {
    const user = await db().users.findUnique({ where: { email } });
    return user || null;
}
export async function findUserByGitHubUsername(githubUsername) {
    const user = await db().users.findUnique({ where: { github_username: githubUsername } });
    return user || null;
}
export async function findUserById(id) {
    const user = await db().users.findUnique({ where: { id } });
    return user || null;
}
export async function createUser(displayName, email, githubUsername) {
    let user = await db().users.create({
        data: {
            display_name: displayName,
            email,
            github_username: githubUsername,
        },
    });
    console.log(chalk.green('✅ New user created:'), chalk.cyan(user.email));
    return user;
}
export async function getOrCreateUserForImport(email, displayName) {
    // First try to find existing user
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        return existingUser;
    }
    // If not found, create placeholder user
    return await createPlaceholderUser(email, displayName);
}
export async function updateUserGitHubUsername(userId, githubUsername) {
    const user = await db().users.update({
        where: { id: userId },
        data: { github_username: githubUsername },
    });
    console.log(chalk.green('✅ Updated GitHub username for user:'), chalk.cyan(user.email), chalk.yellow(githubUsername));
    return user;
}
export async function createPlaceholderUser(email, displayName) {
    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        return existingUser;
    }
    const user = await db().users.create({
        data: {
            email,
            display_name: displayName || email.split('@')[0],
            // is_placeholder: true,
        },
    });
    console.log(chalk.yellow('📝 Placeholder user created for import:'), chalk.cyan(user.email));
    return user;
}
export async function getUserTicketManager(userId) {
    const user = await findUserById(userId);
    if (!user) {
        return null;
    }
    // check if user is in the database
    const userInDatabase = await db().users.findUnique({ where: { id: user.id } });
    if (!userInDatabase) {
        console.error(chalk.red.bold('❌ User not found in database. Unable to authenticate user.'));
        return null;
    }
    // check if they have a linear api key
    const linearApiKey = await db().linear_api_keys.findUnique({ where: { user_id: user.id } });
    if (!linearApiKey) {
        console.error(chalk.red.bold('❌ User does not have a linear api key. Unable to authenticate user.'));
        return null;
    }
    // check if the linear api key is valid
    const linearApiKeyValid = await LinearAdapter.validateKey(linearApiKey.api_key);
    if (!linearApiKeyValid) {
        console.error(chalk.red.bold('❌ Linear api key is invalid. Unable to authenticate user.'));
        return null;
    }
    // TODO: Support JIRA
    // initialize the linear adapter
    return new LinearAdapter(linearApiKey.api_key);
}
//# sourceMappingURL=user.js.map
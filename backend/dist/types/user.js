import { db } from "src/prismaClient";
import chalk from "chalk";
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
            is_placeholder: true,
        },
    });
    console.log(chalk.yellow('📝 Placeholder user created for import:'), chalk.cyan(user.email));
    return user;
}
//# sourceMappingURL=user.js.map
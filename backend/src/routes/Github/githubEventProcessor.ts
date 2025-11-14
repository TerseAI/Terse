import { GithubAppUnifiedEventRequest } from "./githubApp";
import chalk from "chalk";
import { resolveUserForGithubInstallation } from "./githubAppInstallationMatching";
import { User } from "../../types/prisma";
import { EventProcessor } from "../../agent/AutomationAgent/EventProcessor";
import { GithubEvent } from "../../Updater/InputEvents";

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
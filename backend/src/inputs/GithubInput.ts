import { SlackIntegrationManager } from "../integrations/SlackIntegration";
import { ConfigType, GitHubConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";
import chalk from "chalk";


export class GithubInput implements Input<GitHubConfig> {
    integrationManager: SlackIntegrationManager;
    configType: ConfigType = ConfigType.GITHUB;

    constructor() {
        this.integrationManager = new SlackIntegrationManager();
    }

    async addInputToAutomation(tx: PrismaTransaction, automationInputId: string, input: GitHubConfig): Promise<void> {
        await tx.automation_github_configs.create({
            data: {
                automation_input_id: automationInputId,
                repository_ids: input.repositoryIds,
            },
        });
    }
}
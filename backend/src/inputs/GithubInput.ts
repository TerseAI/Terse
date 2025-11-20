import { SlackIntegrationManager } from "src/integrations/SlackIntegration";
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
        console.log(chalk.cyan('🔵 [SLACK INPUT] input:', JSON.stringify(input, null, 2)));
        console.log(chalk.cyan('🔵 [SLACK INPUT] automationInputId:', automationInputId));
        await tx.automation_github_configs.create({
            data: {
                automation_input_id: automationInputId,
                repository_ids: input.repositoryIds,
            },
        });
    }
}
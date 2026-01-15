import { SlackIntegrationManager } from "../integrations/SlackIntegration";
import { ConfigType, GitHubConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";
import { validateGithubRepositoryIds } from "../integrations/githubValidation";


export class GithubInput implements Input<GitHubConfig> {
    integrationManager: SlackIntegrationManager;
    configType: ConfigType = ConfigType.GITHUB;

    constructor() {
        this.integrationManager = new SlackIntegrationManager();
    }

    async validateConfig(input: GitHubConfig, userId: string): Promise<void> {
        await validateGithubRepositoryIds({
            userId,
            integrationId: input.integrationId,
            repositoryIds: input.repositoryIds,
            configTypeLabel: 'github',
            contextLabel: 'input',
        });
    }

    async addInputToChannel(tx: PrismaTransaction, channelInputId: string, input: GitHubConfig): Promise<void> {
        await tx.automation_github_configs.create({
            data: {
                automation_input_id: channelInputId,
                repository_ids: input.repositoryIds,
            },
        });
    }
}
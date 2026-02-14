import { CapabilityDescription, CapabilityRole, getConfigMetadata, getContextLabel } from "../capabilityHelpers"
import { validateGithubRepositoryIds } from "../integrations/GithubIntegration"
import { SlackIntegrationManager } from "../integrations/SlackIntegration"
import { ConfigType, GitHubConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"
import { GitHubConfigSchema, stripConfigForValidation } from "../utility/configSchemas"

import { Trigger } from "./Trigger"

export class GithubTrigger implements Trigger<GitHubConfig> {
    integrationManager: SlackIntegrationManager
    configType: ConfigType = ConfigType.GITHUB

    constructor() {
        this.integrationManager = new SlackIntegrationManager()
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.GITHUB)
        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.GITHUB,
            integrationType: meta.integrationType,
            role: CapabilityRole.TRIGGER,
            tools: [],
            configFields: {
                integrationId: "<integrationId>",
                repositoryIds: "Array of GitHub repository IDs to monitor (numeric IDs from fetchResourcesForIntegration)"
            },
            systemInstructions: ""
        }
    }

    async validateConfig(trigger: GitHubConfig, userId: string): Promise<void> {
        GitHubConfigSchema.parse(stripConfigForValidation(trigger))
        await validateGithubRepositoryIds({
            userId,
            integrationId: trigger.integrationId,
            repositoryIds: trigger.repositoryIds,
            configTypeLabel: "github",
            contextLabel: getContextLabel(CapabilityRole.TRIGGER)
        })
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: GitHubConfig): Promise<void> {
        await tx.automation_github_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                repository_ids: trigger.repositoryIds
            }
        })
    }
}

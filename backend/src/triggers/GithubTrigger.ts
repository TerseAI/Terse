import { ConfigType, GitHubConfig } from "terse-types/Configs"

import { validateGithubRepositoryIds } from "../integrations/GithubIntegration"
import { SlackIntegrationManager } from "../integrations/SlackIntegration"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class GithubTrigger implements Trigger<GitHubConfig> {
    integrationManager: SlackIntegrationManager
    configType: ConfigType = ConfigType.GITHUB

    constructor() {
        this.integrationManager = new SlackIntegrationManager()
    }

    async validateConfig(trigger: GitHubConfig, userId: string): Promise<void> {
        if (!trigger.eventTypes || trigger.eventTypes.length === 0) {
            throw new Error("Invalid trigger config for github: at least one event type must be selected")
        }
        await validateGithubRepositoryIds({
            userId,
            integrationId: trigger.integrationId,
            repositoryIds: trigger.repositoryIds,
            configTypeLabel: "github",
            contextLabel: "trigger"
        })
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: GitHubConfig): Promise<void> {
        await tx.automation_github_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                repository_ids: trigger.repositoryIds,
                event_types: trigger.eventTypes ?? []
            }
        })
    }
}

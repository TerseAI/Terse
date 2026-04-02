import { ConfigType, JiraConfig } from "terse-types/Configs"

import { AtlassianClient } from "../integrations/AtlassianClient"
import { validateJiraProjectExists } from "../integrations/AtlassianIntegration"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class JiraTrigger implements Trigger<JiraConfig> {
    integrationManager: AtlassianClient
    configType: ConfigType = ConfigType.JIRA

    constructor() {
        this.integrationManager = new AtlassianClient()
    }

    async validateConfig(trigger: JiraConfig, _userId: string): Promise<void> {
        // Not doing schema validation here because
        // it errors out. TODO: fix this.
        if (trigger.projectKey) {
            await validateJiraProjectExists(trigger.integrationId, trigger.projectKey)
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: JiraConfig): Promise<void> {
        await tx.automation_jira_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                project_key: trigger.projectKey || null,
                project_id: trigger.projectId || null
            }
        })
    }
}

import { CapabilityDescription, CapabilityRole, getConfigMetadata } from "../capabilityHelpers"
import { AtlassianClient } from "../integrations/AtlassianClient"
import { ConfigType, JiraConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class JiraTrigger implements Trigger<JiraConfig> {
    integrationManager: AtlassianClient
    configType: ConfigType = ConfigType.JIRA

    constructor() {
        this.integrationManager = new AtlassianClient()
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.JIRA)
        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.JIRA,
            integrationType: meta.integrationType,
            role: CapabilityRole.TRIGGER,
            tools: [],
            configFields: {
                integrationId: "<integrationId>",
                projectKey: "Jira project key (optional filter)",
                projectId: "Jira project ID (optional filter)"
            },
            systemInstructions: ""
        }
    }

    async validateConfig(_trigger: JiraConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
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

import { ConfigType, JiraConfig } from "../shared/Configs";
import { Trigger } from "./Trigger";
import { PrismaTransaction } from "../types/prisma";
import { AtlassianIntegrationManager } from "../integrations/AtlassianIntegration";

export class JiraTrigger implements Trigger<JiraConfig> {
    integrationManager: AtlassianIntegrationManager;
    configType: ConfigType = ConfigType.JIRA;

    constructor() {
        this.integrationManager = new AtlassianIntegrationManager();
    }

    async validateConfig(_trigger: JiraConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: JiraConfig): Promise<void> {
        await tx.automation_jira_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                project_key: trigger.projectKey || null,
                project_id: trigger.projectId || null,
            }
        });
    }
}

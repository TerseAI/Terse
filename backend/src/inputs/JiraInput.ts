import { ConfigType, JiraConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";
import { AtlassianIntegrationManager } from "../integrations/AtlassianIntegration";

export class JiraInput implements Input<JiraConfig> {
    integrationManager: AtlassianIntegrationManager;
    configType: ConfigType = ConfigType.JIRA;

    constructor() {
        this.integrationManager = new AtlassianIntegrationManager();
    }

    async validateConfig(_input: JiraConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
    }

    async addInputToChannel(tx: PrismaTransaction, automationInputId: string, input: JiraConfig): Promise<void> {
        await tx.automation_jira_configs.create({
            data: {
                automation_input_id: automationInputId,
                project_key: input.projectKey || null,
                project_id: input.projectId || null,
            }
        });
    }
}


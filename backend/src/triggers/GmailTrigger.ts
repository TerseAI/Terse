import { ConfigType, GmailConfig } from "../shared/Configs";
import { GmailIntegrationManager } from "../integrations/GmailIntegration";
import { Trigger } from "./Trigger";
import { PrismaTransaction } from "../types/prisma";

export class GmailTrigger implements Trigger<GmailConfig> {
    integrationManager: GmailIntegrationManager;
    configType: ConfigType = ConfigType.GMAIL;

    constructor() {
        this.integrationManager = new GmailIntegrationManager();
    }

    async validateConfig(_trigger: GmailConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: GmailConfig): Promise<void> {
        await tx.automation_gmail_configs.create({
            data: {
                automation_input_id: agentTriggerId,
            },
        });
    }
}

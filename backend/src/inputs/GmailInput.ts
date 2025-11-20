import { ConfigType, GmailConfig } from "../shared/Configs";
import { GmailIntegrationManager } from "../integrations/GmailIntegration";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";

export class GmailInput implements Input<GmailConfig> {
    integrationManager: GmailIntegrationManager;
    configType: ConfigType = ConfigType.GMAIL;

    constructor() {
        this.integrationManager = new GmailIntegrationManager();
    }

    async addInputToAutomation(tx: PrismaTransaction, automationInputId: string, input: GmailConfig): Promise<void> {
        await tx.automation_gmail_configs.create({
            data: {
                automation_input_id: automationInputId,
            },
        });
    }
}
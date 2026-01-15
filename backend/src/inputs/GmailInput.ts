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

    async validateConfig(_input: GmailConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
    }

    async addInputToChannel(tx: PrismaTransaction, channelInputId: string, input: GmailConfig): Promise<void> {
        await tx.automation_gmail_configs.create({
            data: {
                automation_input_id: channelInputId,
            },
        });
    }
}
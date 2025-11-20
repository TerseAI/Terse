import { ConfigType, GmailConfig, LinearConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";
import { LinearIntegrationManager } from "../integrations/LinearIntegration";

export class LinearInput implements Input<LinearConfig> {
    integrationManager: LinearIntegrationManager;
    configType: ConfigType = ConfigType.LINEAR;

    constructor() {
        this.integrationManager = new LinearIntegrationManager();
    }

    async addInputToAutomation(tx: PrismaTransaction, automationInputId: string, input: LinearConfig): Promise<void> {
        await tx.automation_linear_configs.create({
            data: {
                automation_input_id: automationInputId
            }
        });
    }
}
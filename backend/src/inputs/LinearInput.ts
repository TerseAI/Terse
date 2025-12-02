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

    async addInputToChannel(tx: PrismaTransaction, channelInputId: string, input: LinearConfig): Promise<void> {
        await tx.automation_linear_configs.create({
            data: {
                automation_input_id: channelInputId,
                team_id: input.teamId || null,
                team_name: input.teamName || null,
                project_id: input.projectId || null,
                project_name: input.projectName || null,
            }
        });
    }
}
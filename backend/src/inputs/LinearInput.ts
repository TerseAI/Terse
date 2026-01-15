import { ConfigType, LinearInputConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";
import { LinearIntegrationManager } from "../integrations/LinearIntegration";

export class LinearInput implements Input<LinearInputConfig> {
    integrationManager: LinearIntegrationManager;
    configType: ConfigType = ConfigType.LINEAR_INPUT;

    constructor() {
        this.integrationManager = new LinearIntegrationManager();
    }

    async validateConfig(_input: LinearInputConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
    }

    async addInputToChannel(tx: PrismaTransaction, channelInputId: string, input: LinearInputConfig): Promise<void> {
        await tx.automation_linear_configs.create({
            data: {
                automation_input_id: channelInputId,
                project_id: input.projectId || null,
                project_name: input.projectName || null,
            }
        });
    }
}
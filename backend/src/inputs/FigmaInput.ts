import { SlackIntegrationManager } from "../integrations/SlackIntegration";
import { ConfigType, FigmaConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";
import chalk from "chalk";
import { FigmaIntegrationManager } from "../integrations/FigmaIntegration";


export class FigmaInput implements Input<FigmaConfig> {
    integrationManager: FigmaIntegrationManager;
    configType: ConfigType = ConfigType.FIGMA;

    constructor() {
        this.integrationManager = new FigmaIntegrationManager();
    }

    async addInputToChannel(tx: PrismaTransaction, channelInputId: string, input: FigmaConfig): Promise<void> {
        await tx.automation_figma_configs.create({
            data: {
                automation_input_id: channelInputId,
                file_key: input.fileKey,
                file_name: input.fileName,
                team_id: input.teamId,
            },
        });
    }
}
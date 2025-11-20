import { SlackIntegrationManager } from "src/integrations/SlackIntegration";
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

    async addInputToAutomation(tx: PrismaTransaction, automationInputId: string, input: FigmaConfig): Promise<void> {
        console.log(chalk.cyan('🔵 [SLACK INPUT] input:', JSON.stringify(input, null, 2)));
        console.log(chalk.cyan('🔵 [SLACK INPUT] automationInputId:', automationInputId));
        await tx.automation_figma_configs.create({
            data: {
                automation_input_id: automationInputId,
                file_key: input.fileKey,
                file_name: input.fileName,
                team_id: input.teamId,
            },
        });
    }
}
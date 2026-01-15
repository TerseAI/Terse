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

    async validateConfig(input: FigmaConfig, _userId: string): Promise<void> {
        const missing: string[] = [];
        if (!input.fileKey) missing.push('fileKey');
        if (!input.teamId) missing.push('teamId');
        if (missing.length > 0) {
            throw new Error(`Invalid input config for figma: missing ${missing.join(' and ')}`);
        }
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
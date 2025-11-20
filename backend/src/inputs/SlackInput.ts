import { SlackIntegrationManager } from "src/integrations/SlackIntegration";
import { ConfigType, SlackConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";
import chalk from "chalk";


export class SlackInput implements Input<SlackConfig> {
    integrationManager: SlackIntegrationManager;
    configType: ConfigType = ConfigType.SLACK;

    constructor() {
        this.integrationManager = new SlackIntegrationManager();
    }

    async addInputToAutomation(tx: PrismaTransaction, automationInputId: string, input: SlackConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_input_id: automationInputId,
                channel_id: input.channelId,
                channel_name: input.channelName,
                listen_to_user_dms: input.listenToUserDms,
            },
        });
    }
}
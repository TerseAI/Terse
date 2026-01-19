import { SlackIntegrationManager } from "../integrations/SlackIntegration";
import { ConfigType, SlackConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";

export class SlackInput implements Input<SlackConfig> {
    integrationManager: SlackIntegrationManager;
    configType: ConfigType = ConfigType.SLACK;

    constructor() {
        this.integrationManager = new SlackIntegrationManager();
    }

    async validateConfig(input: SlackConfig, _userId: string): Promise<void> {
        if (!input.channelId && !input.listenToUserDms) {
            throw new Error('Invalid input config for slack: requires channelId or listenToUserDms=true');
        }
    }

    async addInputToChannel(tx: PrismaTransaction, channelInputId: string, input: SlackConfig): Promise<void> {
        await tx.automation_slack_configs.create({
            data: {
                automation_input_id: channelInputId, // Database column is still automation_input_id
                channel_id: input.channelId,
                channel_name: input.channelName,
                listen_to_user_dms: input.listenToUserDms,
                user_ids: input.userIds,
            },
        });
    }
}
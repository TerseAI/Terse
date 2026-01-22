import { ConfigType, TimeTriggerConfig } from "../shared/Configs";
import { Trigger } from "./Trigger";
import { PrismaTransaction } from "../types/prisma";

export class ScheduleTrigger implements Trigger<TimeTriggerConfig> {
    configType: ConfigType = ConfigType.TIME_TRIGGER;

    constructor() {}

    async validateConfig(trigger: TimeTriggerConfig, _userId: string): Promise<void> {
        if (!trigger.cronExpression) {
            throw new Error('Invalid trigger config for time_trigger: missing cronExpression');
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: TimeTriggerConfig): Promise<void> {
        await tx.automation_time_trigger_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                cron_expression: trigger.cronExpression,
            }
        });
    }
}

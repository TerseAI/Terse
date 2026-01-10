import { ConfigType, TimeTriggerConfig } from "../shared/Configs";
import { Input } from "./Input";
import { PrismaTransaction } from "../types/prisma";

export class ScheduleInput implements Input<TimeTriggerConfig> {
    configType: ConfigType = ConfigType.TIME_TRIGGER;

    constructor() {}

    async addInputToChannel(tx: PrismaTransaction, automationInputId: string, input: TimeTriggerConfig): Promise<void> {
        await tx.automation_time_trigger_configs.create({
            data: {
                automation_input_id: automationInputId,
                cron_expression: input.cronExpression,
            }
        });
    }
}


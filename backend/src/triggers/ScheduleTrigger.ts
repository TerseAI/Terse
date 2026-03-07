import { ConfigType, TimeTriggerConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"
import { TimeTriggerConfigSchema, stripConfigForValidation } from "../utility/configSchemas"

import { Trigger } from "./Trigger"

export class ScheduleTrigger implements Trigger<TimeTriggerConfig> {
    configType: ConfigType = ConfigType.TIME_TRIGGER

    constructor() {}

    async validateConfig(trigger: TimeTriggerConfig, _userId: string): Promise<void> {
        TimeTriggerConfigSchema.parse(stripConfigForValidation(trigger))
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: TimeTriggerConfig): Promise<void> {
        await tx.automation_time_trigger_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                cron_expression: trigger.cronExpression
            }
        })
    }
}

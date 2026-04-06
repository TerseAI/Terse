import { ConfigType, TimeTriggerConfig } from "terse-types/Configs"

import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class ScheduleTrigger implements Trigger<TimeTriggerConfig> {
    configType: ConfigType = ConfigType.TIME_TRIGGER

    constructor() {}

    async validateConfig(trigger: TimeTriggerConfig, _userId: string): Promise<void> {}

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: TimeTriggerConfig): Promise<void> {
        await tx.automation_time_trigger_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                cron_expression: trigger.cronExpression
            }
        })
    }
}

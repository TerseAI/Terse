import { CapabilityDescription, CapabilityRole, getConfigMetadata } from "../capabilityHelpers"
import { ConfigType, TimeTriggerConfig } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class ScheduleTrigger implements Trigger<TimeTriggerConfig> {
    configType: ConfigType = ConfigType.TIME_TRIGGER

    constructor() {}

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.TIME_TRIGGER)
        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.TIME_TRIGGER,
            integrationType: meta.integrationType,
            role: CapabilityRole.TRIGGER,
            tools: [],
            configFields: {
                integrationId: "<integrationId>",
                cronExpression: "Cron expression for schedule (e.g. '0 9 * * 1-5' for weekdays at 9am UTC)"
            },
            systemInstructions: ""
        }
    }

    async validateConfig(trigger: TimeTriggerConfig, _userId: string): Promise<void> {
        if (!trigger.cronExpression) {
            throw new Error("Invalid trigger config for time_trigger: missing cronExpression")
        }
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

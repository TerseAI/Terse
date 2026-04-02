import { ConfigType, WorkOSInputConfig } from "terse-types/Configs"

import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class WorkOSTrigger implements Trigger<WorkOSInputConfig> {
    configType: ConfigType = ConfigType.WORKOS_INPUT

    async validateConfig(trigger: WorkOSInputConfig, _userId: string): Promise<void> {
        if (!trigger.eventTypes || trigger.eventTypes.length === 0) {
            throw new Error("Invalid trigger config for WorkOS: at least one event type must be selected")
        }
    }

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: WorkOSInputConfig): Promise<void> {
        await tx.automation_workos_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                event_types: trigger.eventTypes
            }
        })
    }
}

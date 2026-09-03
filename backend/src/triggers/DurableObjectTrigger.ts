import { ConfigType, DurableObjectInputConfig } from "terse-types/Configs"

import { PrismaTransaction } from "../types/prisma"

import { Trigger } from "./Trigger"

export class DurableObjectTrigger implements Trigger<DurableObjectInputConfig> {
    configType = ConfigType.DURABLE_OBJECT_INPUT

    async validateConfig(_trigger: DurableObjectInputConfig, _userId: string): Promise<void> {}

    async addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, _trigger: DurableObjectInputConfig): Promise<void> {
        await tx.automation_durable_object_configs.create({
            data: {
                automation_input_id: agentTriggerId,
                socket_token: `terse_socket_${crypto.randomUUID()}`
            }
        })
    }
}

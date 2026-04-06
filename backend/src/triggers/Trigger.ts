import { ConfigData, ConfigType } from "terse-types/Configs"

import { PrismaTransaction } from "../types/prisma"

export interface Trigger<TConfig extends ConfigData> {
    configType: ConfigType
    validateConfig(trigger: TConfig, userId: string): Promise<void>
    addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: TConfig): Promise<void>
}

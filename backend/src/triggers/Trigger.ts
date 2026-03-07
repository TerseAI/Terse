import { ConfigInstance, ConfigType } from "../shared/Configs"
import { PrismaTransaction } from "../types/prisma"

export interface Trigger<TConfig extends ConfigInstance> {
    configType: ConfigType
    validateConfig(trigger: TConfig, userId: string): Promise<void>
    addTriggerToAgent(tx: PrismaTransaction, agentTriggerId: string, trigger: TConfig): Promise<void>
}

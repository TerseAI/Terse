import { PrismaTransaction } from "../types/prisma";
import { ConfigInstance, ConfigType } from "../shared/Configs";

export interface Input<
    TConfig extends ConfigInstance
> {
    configType: ConfigType;
    addInputToAutomation(tx: PrismaTransaction, automationInputId: string, input: TConfig): Promise<void>;
}
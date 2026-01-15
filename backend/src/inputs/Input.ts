import { PrismaTransaction } from "../types/prisma";
import { ConfigInstance, ConfigType } from "../shared/Configs";

export interface Input<
    TConfig extends ConfigInstance
> {
    configType: ConfigType;
    validateConfig(input: TConfig, userId: string): Promise<void>;
    addInputToChannel(tx: PrismaTransaction, channelInputId: string, input: TConfig): Promise<void>;
}
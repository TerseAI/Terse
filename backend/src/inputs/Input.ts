import { PrismaTransaction } from "../types/prisma";
import { ConfigInstance, ConfigType } from "../shared/Configs";

export interface Input<
    TConfig extends ConfigInstance
> {
    configType: ConfigType;
    addInputToChannel(tx: PrismaTransaction, channelInputId: string, input: TConfig): Promise<void>;
}
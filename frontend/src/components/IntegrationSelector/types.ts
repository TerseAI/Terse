import { TransientChannelInput } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface InputConfigSelectorProps {
    input: TransientChannelInput;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
    isOutput?: boolean; // true if this is for output configuration, false/undefined for input
}

import { TransientAgentInput } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface InputConfigSelectorProps {
    input: TransientAgentInput;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
}

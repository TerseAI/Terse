import { TransientAutomationInput } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface InputConfigSelectorProps {
    input: TransientAutomationInput;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
}

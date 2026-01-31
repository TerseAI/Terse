import { TransientAgentTrigger } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface InputConfigSelectorProps {
    input: TransientAgentTrigger;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
    /** Hide the manual trigger option (used when agent configuration is not yet complete) */
    disableManualTrigger?: boolean;
}

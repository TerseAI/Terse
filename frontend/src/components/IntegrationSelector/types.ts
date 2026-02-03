import { TransientAgentTrigger } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface InputConfigSelectorProps {
    input: TransientAgentTrigger;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
    /** Whether the agent has been saved to the backend. Used to show/hide certain actions like manual trigger. */
    isAgentSaved?: boolean;
}

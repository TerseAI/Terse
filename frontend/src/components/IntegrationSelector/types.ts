import { TransientAgentTrigger } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface InputConfigSelectorProps {
    input: TransientAgentTrigger;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
    agentId: string | null;
}

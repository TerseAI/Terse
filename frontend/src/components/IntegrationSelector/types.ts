import { TransientAutomationInput } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface InputConfigSelectorProps {
    input: TransientAutomationInput;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
}

export interface BaseIntegrationProps {
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    isConnecting: boolean;
    onConnect: () => void;
    label?: string;
    variant?: 'card' | 'dialog';
}


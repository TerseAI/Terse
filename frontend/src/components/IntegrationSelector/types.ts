import { TransientAgentTrigger } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface AgentSaveState {
    /** Whether the agent has all required fields complete and can be saved */
    isComplete: boolean;
    /** Whether the agent exists in the backend (has been saved at least once) */
    isSaved: boolean;
    /** Whether there are unsaved changes to the agent */
    hasUnsavedChanges: boolean;
    /** Function to save the agent - returns true on success, false on failure */
    saveAgent: () => Promise<boolean>;
}

export interface InputConfigSelectorProps {
    input: TransientAgentTrigger;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
    /** Agent save state - used by TimeTriggerIntegration to validate before triggering */
    agentSaveState?: AgentSaveState;
}

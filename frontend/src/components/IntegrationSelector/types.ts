import { TransientAgentTrigger } from '@/shared/types';
import { ConfigInstance } from '../../shared/Configs';

export interface AgentSaveState {
    /** Whether the agent has been saved to the backend (has an ID) */
    isSavedAgent: boolean;
    /** Whether the agent is currently complete and can be saved */
    isComplete: boolean;
    /** Whether the agent is currently being saved */
    isSaving: boolean;
    /** Function to save the agent and return whether it was successful */
    saveAgent: () => Promise<boolean>;
}

export interface InputConfigSelectorProps {
    input: TransientAgentTrigger;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
    /** Agent save state for features that require a saved agent (e.g., manual trigger) */
    agentSaveState?: AgentSaveState;
}

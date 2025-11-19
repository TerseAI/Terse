import { Plus, PlusIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { LinearConnectionForm } from '../LinearConnectionForm';
import { LinearIntegration as LinearIntegrationType } from "@/shared/Integrations"
import { LinearConfig } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useLinearIntegrations } from '@/hooks/api/useLinearIntegrations';
import { useState } from 'react';
import { StatusOption } from '../ui/DropdownSelect';

export function LinearIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading, mutate: mutateIntegrations } = useLinearIntegrations();
    const currentConfig = input.config as LinearConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(currentConfig?.integrationId);
    const [showForm, setShowForm] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    function onSelect(value: string) {
        const integration = integrations.find((integration: LinearIntegrationType) => integration.id === value);
        if (integration) {
            setSelectedIntegrationId(integration.id);
            // Linear doesn't have a resource selector, so create a minimal config when integration is selected
            const linearConfig = new LinearConfig(
                integration.id,
                currentConfig?.projectId,
                currentConfig?.projectName
            );
            setConfig(linearConfig);
        }
    }

    function onFormSuccess() {
        setShowForm(false);
        mutateIntegrations();
        setIsConnecting(false);
    }

    function onFormCancel() {
        setShowForm(false);
        setIsConnecting(false);
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    // Show form when there are no integrations or when explicitly requested
    if (showForm || integrations.length === 0) {
        if (integrations.length === 0) {
            return (
                <div className="max-w-xs">
                    {!showForm && (
                        <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                            <div className="text-sm text-muted-foreground">
                                No Linear accounts connected
                            </div>
                            <button
                                onClick={() => setShowForm(true)}
                                disabled={isConnecting}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PlusIcon className="w-4 h-4" />
                                {isConnecting ? 'Connecting...' : `Connect Linear`}
                            </button>
                        </div>
                    )}
                    {showForm && (
                        <LinearConnectionForm onSuccess={onFormSuccess} onCancel={onFormCancel} />
                    )}
                </div>
            );
        } else {
            // Show form for adding another connection
            return <LinearConnectionForm onSuccess={onFormSuccess} onCancel={onFormCancel} />;
        }
    }

    // Show selector when integrations exist
    const connectionSelections: StatusOption[] = integrations.map((integration: LinearIntegrationType) => ({
        label: integration.linearTeamName || 'Unknown Team',
        value: integration.id
    }));

    let selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId);
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0];
        setSelectedIntegrationId(defaultIntegration.value);
        // Create minimal config for default selection
        const linearConfig = new LinearConfig(
            defaultIntegration.value,
            currentConfig?.projectId,
            currentConfig?.projectName
        );
        setConfig(linearConfig);
        selectedOption = defaultIntegration;
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0];
    }

    // Card variant: compact view
    if (variant === 'card') {
        return (
            <div className="text-sm">
                {selectedOption ? selectedOption.label : 'No connection selected'}
            </div>
        );
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <label className="font-medium">
                    Linear Team
                </label>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                />
            </div>

            <Button
                onClick={() => setShowForm(true)}
                disabled={isConnecting}
                variant="outline"
            >
                <Plus className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : "Connect Another Linear"}
            </Button>
        </div>
    );
}


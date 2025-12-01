import { Plus, AlertTriangleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { LinearIntegration as LinearIntegrationType, IntegrationType } from "@/shared/Integrations"
import { LinearConfig, ConfigType } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useLinearIntegrations } from '@/hooks/api/useLinearIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { IconForConfigType } from '../../pages/Channels/components/Integration';

export function LinearIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useLinearIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.LINEAR);
    const currentConfig = input.config as LinearConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.LINEAR);

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

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    if (integrations.length === 0) {
        if (variant === 'card') {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Linear
                </div>
            );
        }
        return (
            <div className="max-w-xs flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">
                    No Linear accounts connected
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Linear`}
                </Button>
            </div>
        );
    }

    const connectionSelections = integrations.map((integration: LinearIntegrationType) => ({
        label: integration.workspaceName || 'Unknown Team',
        value: integration.id
    }));

    let selectedOption = connectionSelections.find(option => option.value === currentConfig?.integrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0];
        setSelectedIntegrationId(defaultIntegration.value);
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0];
    }

    // Card variant: compact view
    if (variant === 'card') {
        const isComplete = currentConfig?.isComplete();
        if (!isComplete) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Select team
                </div>
            );
        }
        return (
            <div className="text-sm">
                {selectedOption ? selectedOption.label : 'No connection selected'}
            </div>
        );
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.LINEAR}/>
                </div>
                <span className="font-medium">Linear</span>
            </div>
            <div className="flex flex-row gap-2 items-center">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Synchronizing content within</span>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                    additionalAction={{
                        label: 'Connect Another Linear',
                        onClick: connectOAuth
                    }}
                />
            </div>
        </div>
    );
}


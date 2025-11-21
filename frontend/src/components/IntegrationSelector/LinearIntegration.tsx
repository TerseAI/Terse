import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { LinearIntegration as LinearIntegrationType, IntegrationType } from "@/shared/Integrations"
import { LinearConfig } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useLinearIntegrations } from '@/hooks/api/useLinearIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { StatusOption } from '../ui/DropdownSelect';
import { ConfigType } from '../../shared/Configs';

export function LinearIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useLinearIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.LINEAR);
    const currentConfig = input.config as LinearConfig | undefined;
    const [selectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.LINEAR);

    function onSelect(value: string) {
        const integration = integrations.find((integration: LinearIntegrationType) => integration.id === value);
        if (integration) {
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

    const connectionSelections: StatusOption[] = integrations.map((integration: LinearIntegrationType) => ({
        label: integration.workspaceName || 'Unknown Team',
        value: integration.id
    }));

    let selectedOption: StatusOption | undefined = connectionSelections.find(option => option.value === selectedIntegrationId);
    if (!selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0];
        setConfig(new LinearConfig(
            defaultIntegration.value,
            currentConfig?.projectId,
            currentConfig?.projectName
        ));
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
                onClick={connectOAuth}
                disabled={isOAuthConnecting}
                variant="outline"
            >
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? 'Connecting...' : "Connect Another Linear"}
            </Button>
        </div>
    );
}


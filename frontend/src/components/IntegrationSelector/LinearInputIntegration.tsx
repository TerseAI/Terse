import { Plus, AlertTriangleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { LinearIntegration as LinearIntegrationType, IntegrationType } from "@/shared/Integrations"
import { LinearInputConfig, ConfigType } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useLinearIntegrations } from '@/hooks/api/useLinearIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { IconForConfigType } from '../../pages/Channels/components/Integration';

export function LinearInputIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useLinearIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.LINEAR>(IntegrationType.LINEAR, {});
    const currentConfig = input.config as LinearInputConfig | undefined;
    const [selectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.LINEAR_INPUT);

    function onSelect(value: string) {
        const integration = integrations.find((integration: LinearIntegrationType) => integration.id === value);
        if (integration) {
            // Preserve existing team and project when switching integrations
            const linearConfig = new LinearInputConfig(
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
        setConfig(new LinearInputConfig(
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
        const hasConfig = !!currentConfig && !!currentConfig.integrationId;
        const isComplete = hasConfig;
        if (!isComplete) {
            if (!hasConfig) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Configure
                    </div>
                );
            }
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Configure
                </div>
            );
        }
        return (
            <div className="text-sm">
                {selectedOption?.label || 'No connection selected'}
            </div>
        );
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center mb-2">
                <div className="w-15 h-15">
                    <IconForConfigType type={ConfigType.LINEAR_INPUT}/>
                </div>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                    placeholder="No connection selected"
                    additionalAction={{
                        label: 'Connect Another Linear',
                        onClick: connectOAuth
                    }}
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


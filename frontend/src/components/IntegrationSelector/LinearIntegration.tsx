import { Plus, AlertTriangleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { LinearIntegration as LinearIntegrationType, IntegrationType } from "@/shared/Integrations"
import { LinearConfig, ConfigType } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useLinearIntegrations } from '@/hooks/api/useLinearIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { StatusOption } from '../ui/DropdownSelect';
import { IconForConfigType } from '../../pages/Channels/components/Integration';
import { LinearTeamSelector } from './LinearTeamSelector';

export function LinearIntegration({
    input,
    variant,
    setConfig,
    isOutput = false
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useLinearIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.LINEAR);
    const currentConfig = input.config as LinearConfig | undefined;
    const [selectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.LINEAR);
    const teamRequired = isOutput;

    function onSelect(value: string) {
        const integration = integrations.find((integration: LinearIntegrationType) => integration.id === value);
        if (integration) {
            // Preserve existing team and project when switching integrations
            const linearConfig = new LinearConfig(
                integration.id,
                currentConfig?.teamId,
                currentConfig?.teamName,
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

    const connectionSelections: StatusOption[] = integrations.map((integration: LinearIntegrationType) => ({
        label: integration.workspaceName || 'Unknown Team',
        value: integration.id
    }));

    let selectedOption: StatusOption | undefined = connectionSelections.find(option => option.value === selectedIntegrationId);
    if (!selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0];
        setConfig(new LinearConfig(
            defaultIntegration.value,
            currentConfig?.teamId,
            currentConfig?.teamName,
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
        const needsTeam = teamRequired && !currentConfig?.teamId;
        const isComplete = hasConfig && !needsTeam;
        if (!isComplete) {
            if (!hasConfig) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Configure
                    </div>
                );
            }
            if (needsTeam) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Select team
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
                {currentConfig?.teamName || selectedOption?.label || 'No connection selected'}
            </div>
        );
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center mb-2">
                <div className="w-15 h-15">
                    <IconForConfigType type={ConfigType.LINEAR}/>
                </div>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                />
            </div>

            {/* Team selector - required for output, optional for input */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border min-w-0 overflow-hidden">
                    {!currentConfig?.teamId && (
                        <p className="text-sm text-muted-foreground mb-3">
                            {teamRequired ? 'Select a team to continue' : 'Select a team (optional)'}
                        </p>
                    )}
                    <LinearTeamSelector
                        integrationId={selectedIntegrationId}
                        selectedTeamId={currentConfig?.teamId}
                        onSelect={(teamId: string, teamName: string) => {
                            const updatedConfig = new LinearConfig(
                                selectedIntegrationId,
                                teamId,
                                teamName,
                                currentConfig?.projectId,
                                currentConfig?.projectName
                            );
                            setConfig(updatedConfig);
                        }}
                    />
                </div>
            )}

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


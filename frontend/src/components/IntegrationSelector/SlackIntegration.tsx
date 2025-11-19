import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { SlackChannelSelector } from '../SlackChannelSelector';
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"
import { SlackConfig } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useSlackIntegrations } from '@/hooks/api/useSlackIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { StatusOption } from '../ui/DropdownSelect';
import { useState } from 'react';

export function SlackIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.SLACK);
    const currentConfig = input.config as SlackConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(currentConfig?.integrationId);

    function onSelect(value: string) {
        const integration = integrations.find((integration: SlackIntegrationType) => integration.id === value);
        if (integration) {
            setSelectedIntegrationId(integration.id);
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
                    No Slack accounts connected
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Slack`}
                </Button>
            </div>
        );
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: SlackIntegrationType) => ({
        label: integration.teamName || 'Unknown Workspace',
        value: integration.id
    }));

    let selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId);
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0];
        setSelectedIntegrationId(defaultIntegration.value);
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
                    Slack Workspace
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
                {isOAuthConnecting ? 'Connecting...' : "Connect Another Slack"}
            </Button>

            {/* Slack-specific channel selector */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border">
                    <SlackChannelSelector
                        integrationId={selectedIntegrationId}
                        selectedChannelId={currentConfig?.channelId}
                        listenToUserDms={currentConfig?.listenToUserDms}
                        onSelect={(channelId, channelName) => {
                            const hasChannel = channelId && channelId.trim() !== '';
                            const updatedConfig = new SlackConfig(
                                selectedIntegrationId,
                                hasChannel ? channelId : undefined,
                                hasChannel ? channelName : undefined,
                                hasChannel ? false : currentConfig?.listenToUserDms
                            );
                            setConfig(updatedConfig);
                        }}
                        onListenToUserDmsChange={(listenToUserDms) => {
                            const updatedConfig = new SlackConfig(
                                selectedIntegrationId,
                                listenToUserDms ? undefined : currentConfig?.channelId,
                                listenToUserDms ? undefined : currentConfig?.channelName,
                                listenToUserDms
                            );
                            setConfig(updatedConfig);
                        }}
                    />
                </div>
            )}
        </div>
    );
}


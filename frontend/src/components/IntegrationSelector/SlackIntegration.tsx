import { Plus, AlertTriangleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { SlackConfigurationSelector } from '../SlackChannelSelector';
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"
import { SlackConfig } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useSlackIntegrations } from '@/hooks/api/useSlackIntegrations';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { StatusOption } from '../ui/DropdownSelect';
import { ConfigType } from '../../shared/Configs';
import { useState } from 'react';
import { SlackConnectionOptions } from '../Integrations/helpers/SlackConnectionOptions';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';

export function SlackIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations();

    // Connection options
    const [showConnectionOptions, setShowConnectionOptions] = useState(false);
    const [isBotUser, setIsBotUser] = useState(true);

    const currentConfig = input.config as SlackConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.SLACK);

    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.SLACK>(
        IntegrationType.SLACK,
        { isBotUser }
    );

    const handleConnect = async () => {
        await connectOAuth();
        // Return to previous page after opening OAuth popup
        setShowConnectionOptions(false);
    };

    function onSelect(value: string) {
        const integration = integrations.find((integration: SlackIntegrationType) => integration.id === value);
        if (integration) {
            setSelectedIntegrationId(integration.id);
            const updatedConfig = new SlackConfig(
                integration.id,
                currentConfig?.channelId,
                currentConfig?.channelName,
                currentConfig?.listenToUserDms ?? false,
                currentConfig?.userIds
            );
            setConfig(updatedConfig);
        }
    }

    function onClickConnect() {
        setShowConnectionOptions(true);
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    if (showConnectionOptions) {
        return (
            <SlackConnectionOptions
                isBotUser={isBotUser}
                setIsBotUser={setIsBotUser}
                onBack={() => setShowConnectionOptions(false)}
                onConnect={handleConnect}
                isConnecting={isOAuthConnecting}
            />
        );
    }


    if (integrations.length === 0) {
        if (variant === 'card') {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Slack
                </div>
            );
        }
        return (
            <div className="max-w-xs flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">
                    No Slack accounts connected
                </div>
                <Button
                    onClick={onClickConnect}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Slack`}
                </Button>
            </div>
        );
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: SlackIntegrationType) => ({
        label: `${integration.teamName || 'Unknown Workspace'}${integration.isBotUser === false ? ' - User' : ' - Bot'}`,
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
        const isComplete = currentConfig?.isComplete();
        if (!isComplete) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Select channel or DMs
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
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <label className="font-medium">
                    Slack Workspace
                </label>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                    placeholder="No connection selected"
                />
            </div>

            <Button
                onClick={onClickConnect}
                disabled={isOAuthConnecting}
                variant="outline"
            >
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? 'Connecting...' : "Connect Another Slack"}
            </Button>

            {/* Slack-specific channel selector */}
            {selectedIntegrationId && (() => {
                const selectedIntegration = integrations.find((integration: SlackIntegrationType) => integration.id === selectedIntegrationId);
                const isBotUser = selectedIntegration?.isBotUser ?? true; // Default to true (bot) if not specified
                
                return (
                    <div className="mt-3 pt-3 border-t border-border">
                        {!currentConfig?.isComplete() && (
                            <p className="text-sm text-muted-foreground mb-3">
                                Select a channel or enable DM listening
                            </p>
                        )}
                        <SlackConfigurationSelector
                            integrationId={selectedIntegrationId}
                            selectedChannelId={currentConfig?.channelId ?? ''}
                            selectedUserIds={currentConfig?.userIds ?? []}
                            listenToUserDms={currentConfig?.listenToUserDms}
                            showListenToDMsOption={!isBotUser}
                            showUserFilter={!isBotUser}
                            onSelectChannel={(channelId, channelName) => {
                                const hasChannel = channelId && channelId.trim() !== '';
                                const updatedConfig = new SlackConfig(
                                    selectedIntegrationId,
                                    hasChannel ? channelId : undefined,
                                    hasChannel ? channelName : undefined,
                                    hasChannel ? false : currentConfig?.listenToUserDms,
                                    currentConfig?.userIds
                                );
                                setConfig(updatedConfig);
                            }}
                            onListenToUserDmsChange={(listenToUserDms) => {
                                const updatedConfig = new SlackConfig(
                                    selectedIntegrationId,
                                    listenToUserDms ? undefined : currentConfig?.channelId,
                                    listenToUserDms ? undefined : currentConfig?.channelName,
                                    listenToUserDms,
                                    currentConfig?.userIds
                                );
                                setConfig(updatedConfig);
                            }}
                            onSelectUsers={(userIds) => {
                                const updatedConfig = new SlackConfig(
                                    selectedIntegrationId,
                                    currentConfig?.channelId,
                                    currentConfig?.channelName,
                                    currentConfig?.listenToUserDms,
                                    userIds
                                );
                                setConfig(updatedConfig);
                            }}
                        />
                    </div>
                );
            })()}
        </div>
    );
}


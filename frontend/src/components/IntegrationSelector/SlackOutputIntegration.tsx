import { Plus, AlertTriangleIcon, Hash } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"
import { SlackOutputConfig, ConfigType } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useSlackIntegrations } from '@/hooks/api/useSlackIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { IconForConfigType } from '../../pages/Agents/components/Integration';
import { useSlackChannels } from '@/hooks/api/useSlackChannels';
import { RefreshButton } from '../RefreshButton';
import { SlackChannel } from '@/shared/types';
import { useState } from 'react';
import { SlackConnectionOptions } from '../Integrations/helpers/SlackConnectionOptions';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

export function SlackOutputIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations();
    const currentConfig = input.config as SlackOutputConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.SLACK_OUTPUT);

    // Connection options
    const [showConnectionOptions, setShowConnectionOptions] = useState(false);
    const [isBotUser, setIsBotUser] = useState(true);

    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.SLACK>(
        IntegrationType.SLACK,
        { isBotUser }
    );

    // Fetch channels with DMs included for output selection
    const {
        channels,
        isLoading: channelsLoading,
        isError: channelsError,
        error: channelsErrorMsg,
        isValidating,
        mutate,
    } = useSlackChannels(selectedIntegrationId);

    const handleConnect = async () => {
        await connectOAuth();
        setShowConnectionOptions(false);
    };

    function onSelectIntegration(value: string) {
        const integration = integrations.find((integration: SlackIntegrationType) => integration.id === value);
        if (integration) {
            setSelectedIntegrationId(integration.id);
            // Clear channel selection when switching integrations
            const config = new SlackOutputConfig(
                integration.id,
                undefined,
                undefined
            );
            setConfig(config);
        }
    }

    function onSelectChannel(channelId: string) {
        if (!selectedIntegrationId) return;

        const selectedChannel = channels.find(ch => ch.id === channelId);
        if (selectedChannel) {
            const config = new SlackOutputConfig(
                selectedIntegrationId,
                selectedChannel.id,
                selectedChannel.name
            );
            setConfig(config);
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
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
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

    const connectionSelections = integrations.map((integration: SlackIntegrationType) => ({
        label: `${integration.teamName || 'Unknown Workspace'}${integration.isBotUser === false ? ' - User' : ' - Bot'}`,
        value: integration.id
    }));

    let selectedOption = connectionSelections.find(option => option.value === currentConfig?.integrationId);
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length === 1) {
        const defaultIntegration = connectionSelections[0];
        setSelectedIntegrationId(defaultIntegration.value);
        setConfig(new SlackOutputConfig(
            defaultIntegration.value,
            currentConfig?.channelId,
            currentConfig?.channelName
        ));
        selectedOption = defaultIntegration;
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0];
    }

    // Card variant: compact view
    if (variant === 'card') {
        const hasConfig = !!currentConfig && !!currentConfig.integrationId;
        const needsChannel = !currentConfig?.channelId;
        const isComplete = hasConfig && !needsChannel;
        if (!isComplete) {
            if (!hasConfig) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Configure
                    </div>
                );
            }
            if (needsChannel) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Select destination
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
            <div className="text-sm flex items-center gap-1">
                <Hash className="w-3 h-3 text-muted-foreground" />
                {currentConfig?.channelName || selectedOption?.label || 'No connection selected'}
            </div>
        );
    }

    // Group channels for display
    const publicChannels = channels.filter((ch: SlackChannel) => !ch.isPrivate && !ch.isArchived);
    const privateChannels = channels.filter((ch: SlackChannel) => ch.isPrivate && !ch.isArchived && !ch.isMPIM);
    const groupChannels = channels.filter((ch: SlackChannel) => ch.isMPIM && !ch.isArchived);

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.SLACK_OUTPUT}/>
                </div>
                <div className="flex-1 min-w-0">
                    <DropdownSelect
                        statusOptions={connectionSelections}
                        selectedOption={selectedOption}
                        setSelected={onSelectIntegration}
                        placeholder="No connection selected"
                        additionalAction={{
                            label: 'Connect Another Slack',
                            onClick: onClickConnect
                        }}
                    />
                </div>
            </div>

            {/* Channel selector */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border min-w-0 overflow-hidden">
                    {!currentConfig?.channelId && (
                        <p className="text-sm text-muted-foreground mb-3">
                            Select where Terse should send messages
                        </p>
                    )}
                    
                    {channelsLoading ? (
                        <div className="text-sm text-muted-foreground">
                            Loading channels...
                        </div>
                    ) : channelsError ? (
                        <div className="space-y-2">
                            <div className="text-sm text-red-600">{String(channelsErrorMsg)}</div>
                            <RefreshButton
                                onClick={() => mutate()}
                                isRefreshing={false}
                                label="Try again"
                                variant="link"
                                size="sm"
                                className="h-auto px-0 text-xs"
                            />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">
                                    Destination
                                </label>
                                <RefreshButton
                                    onClick={() => mutate()}
                                    isRefreshing={isValidating && !channelsLoading}
                                    title="Refresh channel list"
                                />
                            </div>
                            
                            <Select
                                value={currentConfig?.channelId || ''}
                                onValueChange={onSelectChannel}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a channel" />
                                </SelectTrigger>
                                <SelectContent>
                                    {publicChannels.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel>Public Channels</SelectLabel>
                                            {publicChannels.map((channel: SlackChannel) => (
                                                <SelectItem key={channel.id} value={channel.id}>
                                                    <span className="flex items-center gap-2">
                                                        <Hash className="w-3 h-3" />
                                                        {channel.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                    {privateChannels.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel>Private Channels</SelectLabel>
                                            {privateChannels.map((channel: SlackChannel) => (
                                                <SelectItem key={channel.id} value={channel.id}>
                                                    <span className="flex items-center gap-2">
                                                        🔒 {channel.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                    {groupChannels.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel>Group Messages</SelectLabel>
                                            {groupChannels.map((channel: SlackChannel) => (
                                                <SelectItem key={channel.id} value={channel.id}>
                                                    <span className="flex items-center gap-2">
                                                        👥 {channel.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                </SelectContent>
                            </Select>
                            
                            {channels.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                    {channels.length} destination{channels.length !== 1 ? 's' : ''} available
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <Button
                onClick={onClickConnect}
                disabled={isOAuthConnecting}
                variant="outline"
            >
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? 'Connecting...' : "Connect Another Slack"}
            </Button>
        </div>
    );
}

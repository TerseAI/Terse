import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { SlackChannelSelector } from '../SlackChannelSelector';
import { INTEGRATION_METADATA, IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"
import { SlackConfig } from '../../shared/types';
import { BaseIntegrationProps } from './types';
import { useSlackIntegrations } from '@/hooks/api/useSlackIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';

interface SlackIntegrationProps extends BaseIntegrationProps {
    integrationType: IntegrationType;
    slackConfig?: SlackConfig;
    onSlackConfigChange?: (config: SlackConfig) => void;
}

export function SlackIntegration({
    selectedIntegrationId,
    onSelect,
    label = 'Connection',
    slackConfig,
    onSlackConfigChange,
    variant
}: SlackIntegrationProps) {
    const { integrations, isLoading } = useSlackIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.SLACK);
    const metadata = INTEGRATION_METADATA[IntegrationType.SLACK];

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
                    No {metadata.name} accounts connected
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect ${metadata.name}`}
                </Button>
            </div>
        );
    }

    const connectionSelections = integrations.map((integration: SlackIntegrationType) => ({
        label: integration.teamName || 'Unknown Workspace',
        value: integration.id
    }));
    const selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId) || connectionSelections[0];

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
                    {label}
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
                {isOAuthConnecting ? 'Connecting...' : `Connect Another ${metadata.name}`}
            </Button>

            {/* Slack-specific channel selector */}
            {selectedIntegrationId && onSlackConfigChange && (
                <div className="mt-3 pt-3 border-t border-border">
                    <SlackChannelSelector
                        integrationId={selectedIntegrationId}
                        selectedChannelId={slackConfig?.channelId}
                        listenToUserDms={slackConfig?.listenToUserDms}
                        onSelect={(channelId, channelName) => {
                            const hasChannel = channelId && channelId.trim() !== '';
                            onSlackConfigChange({
                                ...slackConfig,
                                channelId: hasChannel ? channelId : undefined,
                                channelName: hasChannel ? channelName : undefined,
                                // Clear listenToUserDms when a channel is selected
                                listenToUserDms: hasChannel ? false : slackConfig?.listenToUserDms
                            });
                        }}
                        onListenToUserDmsChange={(listenToUserDms) => {
                            onSlackConfigChange({
                                ...slackConfig,
                                listenToUserDms,
                                // Clear channelId when DMs are selected
                                channelId: listenToUserDms ? undefined : slackConfig?.channelId,
                                channelName: listenToUserDms ? undefined : slackConfig?.channelName
                            });
                        }}
                    />
                </div>
            )}
        </div>
    );
}


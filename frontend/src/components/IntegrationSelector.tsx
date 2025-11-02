import { Check, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Integration } from '../context/Integrations';
import { BackendProvider } from '../services/backend';
import { formatIntegrationDisplay } from '../utility/IntegrationFormatters';
import { getIntegrationInstances, getIntegrationName } from '../utility/IntegrationUtils';
import { NotionConfig, SlackConfig } from '../shared/types';
import { NotionDatabaseSelector } from './NotionDatabaseSelector';
import { SlackChannelSelector } from './SlackChannelSelector';
import DropdownSelect from './ui/DropdownSelect';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface IntegrationInstance {
    id: string;
    [key: string]: any;
}

interface IntegrationSelectorProps {
    integrationType: Integration;
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    label?: string;
    // Optional config handlers for integration-specific settings
    notionConfig?: NotionConfig;
    onNotionConfigChange?: (config: NotionConfig) => void;
    slackConfig?: SlackConfig;
    onSlackConfigChange?: (config: SlackConfig) => void;
}

export function IntegrationSelector({
    integrationType,
    selectedIntegrationId,
    onSelect,
    label = 'Connection',
    notionConfig,
    onNotionConfigChange,
    slackConfig,
    onSlackConfigChange
}: IntegrationSelectorProps) {
    const [integrations, setIntegrations] = useState<IntegrationInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        fetchIntegrations();

        // Listen for OAuth completion messages
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'oauth-success') {
                fetchIntegrations();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [integrationType]);

    const fetchIntegrations = async () => {
        setIsLoading(true);
        try {
            const response = await BackendProvider.getIntegrationsStatus();
            const instances = getIntegrationInstances(response.integrations, integrationType);

            setIntegrations(instances);

            // Auto-select first integration if none is selected and we have options
            if (instances.length > 0 && !selectedIntegrationId) {
                onSelect(instances[0].id);
            }
        } catch (error) {
            console.error('Error fetching integrations:', error);
            setIntegrations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnectNew = async () => {
        setIsConnecting(true);
        try {
            let oauthUrl = '';

            switch (integrationType) {
                case Integration.GMAIL:
                    const gmailResponse = await BackendProvider.requestGmailOAuthUrl();
                    oauthUrl = gmailResponse.url;
                    break;
                case Integration.NOTION:
                    const notionResponse = await BackendProvider.requestNotionOAuthUrl();
                    oauthUrl = notionResponse.url;
                    break;
                case Integration.SLACK:
                    const slackResponse = await BackendProvider.requestSlackOAuthUrl();
                    oauthUrl = slackResponse.url;
                    break;
                case Integration.GITHUB:
                    const githubResponse = await BackendProvider.requestGitHubAppInstallationUrl();
                    oauthUrl = githubResponse.installationUrl;
                    break;
                default:
                    console.error('OAuth not supported for this integration type');
                    return;
            }

            if (oauthUrl) {
                window.open(oauthUrl, 'oauth-popup', 'width=600,height=700');
            }
        } catch (error) {
            console.error('Error initiating OAuth:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">
                    No {getIntegrationName(integrationType)} accounts connected
                </div>
                <Button
                    onClick={handleConnectNew}
                    disabled={isConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isConnecting ? 'Connecting...' : `Connect ${getIntegrationName(integrationType)}`}
                </Button>
            </div>
        );
    }

    const connectionSelections = integrations.map((integration) => ({
        label: formatIntegrationDisplay(integration, integrationType),
        value: integration.id
    }));
    const selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId) || connectionSelections[0];
    const statusOptions = connectionSelections;
    const setSelected = (selectedOption: string) => onSelect(selectedOption);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <label className="font-medium">
                    {label}
                </label>
                <DropdownSelect
                    statusOptions={statusOptions}
                    selectedOption={selectedOption}
                    setSelected={setSelected}
                />
            </div>

            <Button
                onClick={handleConnectNew}
                disabled={isConnecting}
                variant="outline"
            >
                <Plus className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : `Connect Another ${getIntegrationName(integrationType)}`}
            </Button>

            {selectedIntegrationId && (
                <Badge variant="secondary" className="w-fit">
                    <Check className="size-3" />
                    Selected: {formatIntegrationDisplay(
                        integrations.find(i => i.id === selectedIntegrationId)!,
                        integrationType
                    )}
                </Badge>
            )}

            {/* Notion-specific database selector */}
            {integrationType === Integration.NOTION && selectedIntegrationId && onNotionConfigChange && (
                <div className="mt-3 pt-3 border-t border-[theme(border)]">
                    <NotionDatabaseSelector
                        integrationId={selectedIntegrationId}
                        selectedDatabaseId={notionConfig?.databaseId}
                        onSelect={(databaseId, databaseName) => {
                            onNotionConfigChange({
                                databaseId,
                                databaseName
                            });
                        }}
                    />
                </div>
            )}

            {/* Slack-specific channel selector */}
            {integrationType === Integration.SLACK && selectedIntegrationId && onSlackConfigChange && (
                <div className="mt-3 pt-3 border-t border-[theme(border)]">
                    <SlackChannelSelector
                        integrationId={selectedIntegrationId}
                        selectedChannelId={slackConfig?.channelId}
                        onSelect={(channelId, channelName) => {
                            onSlackConfigChange({
                                channelId,
                                channelName
                            });
                        }}
                    />
                </div>
            )}
        </div>
    );
}

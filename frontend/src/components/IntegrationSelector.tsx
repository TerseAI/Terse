import { Plus, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Integration } from '../context/Integrations';
import { BackendProvider } from '../services/backend';
import { formatIntegrationDisplay, IntegrationInstance } from '../utility/IntegrationFormatters';
import { getIntegrationInstances, getIntegrationName } from '../utility/IntegrationUtils';
import { NotionConfig, NotionPageConfig, NotionResourceType, SlackConfig, FigmaConfig } from '../shared/types';
import { NotionResourceSelector } from './NotionResourceSelector';
import { SlackChannelSelector } from './SlackChannelSelector';
import { FigmaFileSelector } from './FigmaFileSelector';
import { LinearConnectionForm } from './LinearConnectionForm';
import { JiraConnectionForm } from './JiraConnectionForm';
import DropdownSelect from './ui/DropdownSelect';
import { Button } from './ui/button';

interface IntegrationSelectorProps {
    integrationType: Integration;
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    label?: string;
    // Optional config handlers for integration-specific settings
    notionConfig?: NotionConfig;
    notionPageConfig?: NotionPageConfig;
    onNotionConfigChange?: (config: NotionConfig) => void;
    onNotionPageConfigChange?: (config: NotionPageConfig) => void;
    slackConfig?: SlackConfig;
    onSlackConfigChange?: (config: SlackConfig) => void;
    figmaConfig?: FigmaConfig;
    onFigmaConfigChange?: (config: FigmaConfig) => void;
}

export function IntegrationSelector({
    integrationType,
    selectedIntegrationId,
    onSelect,
    label = 'Connection',
    notionConfig,
    onNotionConfigChange,
    notionPageConfig,
    onNotionPageConfigChange,
    slackConfig,
    onSlackConfigChange,
    figmaConfig,
    onFigmaConfigChange
}: IntegrationSelectorProps) {
    const [integrations, setIntegrations] = useState<IntegrationInstance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showForm, setShowForm] = useState(false);

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
        // For Jira and Linear, show form instead of OAuth
        if (integrationType === Integration.JIRA || integrationType === Integration.LINEAR) {
            setShowForm(true);
            return;
        }

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
                case Integration.FIGMA:
                    const figmaResponse = await BackendProvider.requestFigmaOAuthUrl();
                    oauthUrl = figmaResponse.url;
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

    const handleFormSuccess = async () => {
        setShowForm(false);
        await fetchIntegrations();
    };

    const handleFormCancel = () => {
        setShowForm(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    // Show form for Jira/Linear if no connections or if showForm is true
    if ((integrations.length === 0 || showForm) && (integrationType === Integration.JIRA || integrationType === Integration.LINEAR)) {
        if (integrationType === Integration.LINEAR) {
            return (
                <div>
                    {!showForm && integrations.length === 0 && (
                        <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-[theme(border)] bg-[theme(background-light)]">
                            <div className="text-sm text-[theme(text-secondary)]">
                                No {getIntegrationName(integrationType)} accounts connected
                            </div>
                            <button
                                onClick={handleConnectNew}
                                disabled={isConnecting}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[theme(--color-accent)] text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PlusIcon className="w-4 h-4" />
                                {isConnecting ? 'Connecting...' : `Connect ${getIntegrationName(integrationType)}`}
                            </button>
                        </div>
                    )}
                    {showForm && (
                        <LinearConnectionForm onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
                    )}
                </div>
            );
        }

        if (integrationType === Integration.JIRA) {
            return (
                <div>
                    {!showForm && integrations.length === 0 && (
                        <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-[theme(border)] bg-[theme(background-light)]">
                            <div className="text-sm text-[theme(text-secondary)]">
                                No {getIntegrationName(integrationType)} accounts connected
                            </div>
                            <button
                                onClick={handleConnectNew}
                                disabled={isConnecting}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-[theme(--color-accent)] text-white rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PlusIcon className="w-4 h-4" />
                                {isConnecting ? 'Connecting...' : `Connect ${getIntegrationName(integrationType)}`}
                            </button>
                        </div>
                    )}
                    {showForm && (
                        <JiraConnectionForm onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
                    )}
                </div>
            );
        }
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

            {/* Notion-specific database selector */}
            {(integrationType === Integration.NOTION || integrationType === Integration.NOTION_PAGE) && selectedIntegrationId && onNotionConfigChange && (
                <div className="mt-3 pt-3 border-t border-[theme(border)]">
                    <NotionResourceSelector
                        integrationId={selectedIntegrationId}
                        selectedResourceId={notionPageConfig?.pageId || notionConfig?.databaseId}
                        onSelect={(resourceId: string, resourceName: string, resourceType: NotionResourceType) => {
                            if (resourceType === 'database') {
                                onNotionConfigChange?.({
                                    databaseId: resourceId,
                                    databaseName: resourceName
                                });
                            } else {
                                onNotionPageConfigChange?.({
                                    pageId: resourceId,
                                    pageName: resourceName
                                });
                            }
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

            {/* Figma-specific file selector */}
            {integrationType === Integration.FIGMA && selectedIntegrationId && onFigmaConfigChange && (
                <div className="mt-3 pt-3 border-t border-[theme(border)]">
                    <FigmaFileSelector
                        integrationId={selectedIntegrationId}
                        selectedFileKey={figmaConfig?.fileKey}
                        selectedFileName={figmaConfig?.fileName}
                        onSelect={(fileKey, fileName) => {
                            onFigmaConfigChange({
                                fileKey,
                                fileName
                            });
                        }}
                    />
                </div>
            )}
        </div>
    );
}

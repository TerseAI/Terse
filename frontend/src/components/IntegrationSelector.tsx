import { PlusIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { Integration } from '../context/Integrations';
import { BackendProvider } from '../services/backend';
import { formatIntegrationDisplay } from '../utility/IntegrationFormatters';
import { getIntegrationInstances, getIntegrationName } from '../utility/IntegrationUtils';
import DropdownSelect from './ui/DropdownSelect';

interface IntegrationInstance {
    id: string;
    [key: string]: any;
}

interface IntegrationSelectorProps {
    integrationType: Integration;
    selectedIntegrationId?: string;
    onSelect: (integrationId: string) => void;
    label?: string;
}

export function IntegrationSelector({
    integrationType,
    selectedIntegrationId,
    onSelect,
    label = 'Connection'
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

            // Auto-select if only one option and none selected
            if (instances.length === 1 && !selectedIntegrationId) {
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
            <div className="flex items-center gap-2 text-sm text-[theme(text-secondary)]">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[theme(--color-accent)] border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    if (integrations.length === 0) {
        return (
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
                <label className="text-sm font-medium text-[theme(text-primary)]">
                    {label}
                </label>
                <DropdownSelect
                    statusOptions={statusOptions}
                    selectedOption={selectedOption}
                    setSelected={setSelected}
                />
            </div>

            <button
                onClick={handleConnectNew}
                disabled={isConnecting}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-[theme(background-light)] text-[theme(text-secondary)] rounded-lg hover:bg-[theme(background-hover)] hover:text-[theme(text-primary)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-[theme(border)]"
            >
                <PlusIcon className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : `Connect Another ${getIntegrationName(integrationType)}`}
            </button>

            {selectedIntegrationId && (
                <div className="text-xs text-[theme(text-secondary)] px-1">
                    ✓ Selected: {formatIntegrationDisplay(
                        integrations.find(i => i.id === selectedIntegrationId)!,
                        integrationType
                    )}
                </div>
            )}
        </div>
    );
}

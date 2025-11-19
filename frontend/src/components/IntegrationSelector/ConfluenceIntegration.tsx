import { Plus, PlusIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { AtlassianConnectionForm } from '../AtlassianConnectionForm';
import { AtlassianIntegration, INTEGRATION_METADATA, IntegrationType } from "@/shared/Integrations"
import { ConfluenceConfig } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { ConfluenceResourceSelector } from '../ConfluenceResourceSelector';
import { useAtlassianIntegrations } from '@/hooks/api/useAtlassianIntegrations';
import { useState } from 'react';
import { StatusOption } from '../ui/DropdownSelect';

export function ConfluenceIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading, mutate: mutateIntegrations } = useAtlassianIntegrations();
    const metadata = INTEGRATION_METADATA[IntegrationType.ATLASSIAN];
    const currentConfig = input.config as ConfluenceConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(currentConfig?.integrationId);
    const [showForm, setShowForm] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    function onSelect(value: string) {
        const integration = integrations.find((integration: AtlassianIntegration) => integration.id === value);
        if (integration) {
            setSelectedIntegrationId(integration.id);
        }
    }

    function onFormSuccess() {
        setShowForm(false);
        mutateIntegrations();
        setIsConnecting(false);
    }

    function onFormCancel() {
        setShowForm(false);
        setIsConnecting(false);
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    // Show form when there are no integrations or when explicitly requested
    if (showForm || integrations.length === 0) {
        if (integrations.length === 0) {
            return (
                <div className="max-w-xs">
                    {!showForm && (
                        <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                            <div className="text-sm text-muted-foreground">
                                No {metadata.name} accounts connected
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Confluence uses the same credentials as Jira. If you have a Jira connection, it will be available here.
                            </div>
                            <button
                                onClick={() => setShowForm(true)}
                                disabled={isConnecting}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PlusIcon className="w-4 h-4" />
                                {isConnecting ? 'Connecting...' : `Connect ${metadata.name}`}
                            </button>
                        </div>
                    )}
                    {showForm && (
                        <AtlassianConnectionForm onSuccess={onFormSuccess} onCancel={onFormCancel} integrationType={metadata.type} />
                    )}
                </div>
            );
        } else {
            // Show form for adding another connection
            return <AtlassianConnectionForm onSuccess={onFormSuccess} onCancel={onFormCancel} integrationType={metadata.type} />;
        }
    }

    // Show selector when integrations exist
    const connectionSelections: StatusOption[] = integrations.map((integration: AtlassianIntegration) => ({
        label: integration.siteName || 'Unknown Site',
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
                    Atlassian Site
                </label>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                />
            </div>

            <Button
                onClick={() => setShowForm(true)}
                disabled={isConnecting}
                variant="outline"
            >
                <Plus className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : `Connect Another ${metadata.name}`}
            </Button>

            {/* Confluence-specific resource selector */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border">
                    <ConfluenceResourceSelector
                        integrationId={selectedIntegrationId}
                        selectedResourceId={currentConfig?.pageId}
                        onSelect={(resourceId, resourceTitle, spaceId, spaceName) => {
                            const updatedConfig = new ConfluenceConfig(
                                selectedIntegrationId,
                                spaceName,
                                spaceId,
                                resourceId,
                                resourceTitle
                            );
                            setConfig(updatedConfig);
                        }}
                    />
                </div>
            )}
        </div>
    );
}


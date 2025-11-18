import { Plus, PlusIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { AtlassianConnectionForm } from '../AtlassianConnectionForm';
import { formatIntegrationDisplay, IntegrationInstance } from '../../utility/IntegrationFormatters';
import { getIntegrationName } from '../../utility/IntegrationUtils';
import { IntegrationType } from "@/shared/Integrations"
import { ConfluenceConfig } from '../../shared/types';
import { BaseIntegrationProps } from './types';
import { ConfluenceResourceSelector } from '../ConfluenceResourceSelector';

interface ConfluenceIntegrationProps extends BaseIntegrationProps {
    integrationType: IntegrationType;
    showForm: boolean;
    onFormSuccess: () => void;
    onFormCancel: () => void;
    confluenceConfig?: ConfluenceConfig;
    onConfluenceConfigChange?: (config: ConfluenceConfig) => void;
}

export function ConfluenceIntegration({
    selectedIntegrationId,
    onSelect,
    integrations,
    isLoading,
    isConnecting,
    onConnect,
    label = 'Connection',
    integrationType,
    showForm,
    onFormSuccess,
    onFormCancel,
    confluenceConfig,
    onConfluenceConfigChange,
    variant
}: ConfluenceIntegrationProps) {
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
                                No {getIntegrationName(integrationType)} accounts connected
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Confluence uses the same credentials as Jira. If you have a Jira connection, it will be available here.
                            </div>
                            <button
                                onClick={onConnect}
                                disabled={isConnecting}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PlusIcon className="w-4 h-4" />
                                {isConnecting ? 'Connecting...' : `Connect ${getIntegrationName(integrationType)}`}
                            </button>
                        </div>
                    )}
                    {showForm && (
                        <AtlassianConnectionForm onSuccess={onFormSuccess} onCancel={onFormCancel} integrationType={integrationType} />
                    )}
                </div>
            );
        } else {
            // Show form for adding another connection
            return <AtlassianConnectionForm onSuccess={onFormSuccess} onCancel={onFormCancel} integrationType={integrationType} />;
        }
    }

    // Show selector when integrations exist
    const connectionSelections = integrations.map((integration: IntegrationTypeInstance) => ({
        label: formatIntegrationDisplay(integration, integrationType),
        value: IntegrationTypeType.id
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
                onClick={onConnect}
                disabled={isConnecting}
                variant="outline"
            >
                <Plus className="w-4 h-4" />
                {isConnecting ? 'Connecting...' : `Connect Another ${getIntegrationName(integrationType)}`}
            </Button>

            {/* Confluence-specific resource selector */}
            {selectedIntegrationId && onConfluenceConfigChange && (
                <div className="mt-3 pt-3 border-t border-border">
                    <ConfluenceResourceSelector
                        integrationId={selectedIntegrationId}
                        selectedResourceId={confluenceConfig?.pageId}
                        onSelect={(resourceId, resourceTitle, spaceId, spaceName) => {
                            onConfluenceConfigChange({
                                ...confluenceConfig,
                                pageId: resourceId,
                                pageName: resourceTitle,
                                spaceId: spaceId,
                                spaceName: spaceName,
                            });
                        }}
                    />
                </div>
            )}
        </div>
    );
}


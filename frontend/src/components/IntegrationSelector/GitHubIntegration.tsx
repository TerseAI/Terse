import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { formatIntegrationDisplay, IntegrationInstance } from '../../utility/IntegrationFormatters';
import { getIntegrationName } from '../../utility/IntegrationUtils';
import { Integration } from '../../context/Integrations';
import { BaseIntegrationProps } from './types';

interface GitHubIntegrationProps extends BaseIntegrationProps {
    integrationType: Integration;
}

export function GitHubIntegration({
    selectedIntegrationId,
    onSelect,
    integrations,
    isLoading,
    isConnecting,
    onConnect,
    label = 'Connection',
    integrationType,
    variant
}: GitHubIntegrationProps) {
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
                    No {getIntegrationName(integrationType)} accounts connected
                </div>
                <Button
                    onClick={onConnect}
                    disabled={isConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isConnecting ? 'Connecting...' : `Connect ${getIntegrationName(integrationType)}`}
                </Button>
            </div>
        );
    }

    const connectionSelections = integrations.map((integration: IntegrationInstance) => ({
        label: formatIntegrationDisplay(integration, integrationType),
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
        <div className="max-w-xs flex flex-col gap-3">
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
        </div>
    );
}


import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { IntegrationType } from "@/shared/Integrations"
import { BaseIntegrationProps } from './types';
import { useGmailIntegrations } from '@/hooks/api/useGmailIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { GmailIntegration as GmailIntegrationType } from '@/shared/types';

interface GmailIntegrationProps extends BaseIntegrationProps {
    integrationType: IntegrationType;
}

export function GmailIntegration({
    selectedIntegrationId,
    onSelect,
    label = 'Connection',
    variant
}: GmailIntegrationProps) {
    const { integrations, isLoading } = useGmailIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.GMAIL);


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
                    No Gmail accounts connected
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Gmail`}
                </Button>
            </div>
        );
    }

    const connectionSelections = integrations.map((integration: GmailIntegrationType) => ({
        label: integration.email,
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
                {isOAuthConnecting ? 'Connecting...' : "Connect Another Gmail"}
            </Button>
        </div>
    );
}


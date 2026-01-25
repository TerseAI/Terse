import { Plus, AlertTriangleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { IntegrationType, GmailIntegration as GmailIntegrationType } from "@/shared/Integrations"
import { InputConfigSelectorProps } from './types';
import { useGmailIntegrations } from '@/hooks/api/useGmailIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { GmailConfig, ConfigType } from '@/shared/Configs';
import { StatusOption } from '../ui/DropdownSelect';

export function GmailIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useGmailIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.GMAIL>(IntegrationType.GMAIL, {});
    const currentConfig = input.config as GmailConfig | undefined;
    const [selectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.GMAIL);

    function onSelect(value: string) {
        const integration = integrations.find((integration: GmailIntegrationType) => integration.id === value);
        if (integration) {
            const gmailConfig = new GmailConfig(integration.id);
            setConfig(gmailConfig);
        }
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    if (integrations.length === 0) {
        if (variant === 'card') {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Gmail
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
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

    const connectionSelections: StatusOption[] = integrations.map((integration: GmailIntegrationType) => ({
        label: integration.email,
        value: integration.id
    }));

    let selectedOption: StatusOption | undefined = connectionSelections.find(option => option.value === selectedIntegrationId);
    if (!selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0];
        setConfig(new GmailConfig(defaultIntegration.value));
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
                    Select account
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
                    Gmail Account
                </label>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                    placeholder="No connection selected"
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
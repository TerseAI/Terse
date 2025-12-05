import { Plus, AlertTriangleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { AtlassianIntegration, IntegrationType } from "@/shared/Integrations"
import { ConfluenceConfig, ConfigType } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { ConfluenceResourceSelector } from '../ConfluenceResourceSelector';
import { useAtlassianIntegrations } from '@/hooks/api/useAtlassianIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { StatusOption } from '../ui/DropdownSelect';

export function ConfluenceIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useAtlassianIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.ATLASSIAN);
    const currentConfig = input.config as ConfluenceConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.CONFLUENCE);

    function onSelect(value: string) {
        const integration = integrations.find((integration: AtlassianIntegration) => integration.id === value);
        if (integration) {
            setSelectedIntegrationId(integration.id);
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
                    Connect Atlassian
                </div>
            );
        }
        return (
            <div className="max-w-xs flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">
                    No Atlassian accounts connected
                </div>
                <div className="text-xs text-muted-foreground">
                    Confluence uses the same credentials as Jira. If you have a Jira connection, it will be available here.
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Atlassian`}
                </Button>
            </div>
        );
    }

    // Show selector when integrations exist
    const connectionSelections: StatusOption[] = integrations.map((integration: AtlassianIntegration) => ({
        label: integration.siteName || integration.baseUrl || 'Unknown Site',
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
        const hasPage = currentConfig?.pageId;
        if (!hasPage) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Select page
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
                    Atlassian Site
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
                {isOAuthConnecting ? 'Connecting...' : "Connect Another Atlassian"}
            </Button>

            {/* Confluence-specific resource selector */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border">
                    {!currentConfig?.pageId && (
                        <p className="text-sm text-muted-foreground mb-3">
                            Select a page to continue
                        </p>
                    )}
                    <ConfluenceResourceSelector
                        integrationId={selectedIntegrationId}
                        selectedResourceId={currentConfig?.pageId}
                        selectedResourceName={currentConfig?.pageName}
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


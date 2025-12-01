import { Plus, AlertTriangleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { NotionResourceSelector } from '../NotionResourceSelector';
import { IntegrationType, NotionIntegration as NotionIntegrationType } from "@/shared/Integrations"
import { NotionConfig, NotionPageConfig, ConfigType } from '../../shared/Configs';
import { NotionResourceType } from '@/shared/types';
import { InputConfigSelectorProps } from './types';
import { useNotionIntegrations } from '@/hooks/api/useNotionIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { IconForConfigType } from '../../pages/Channels/components/Integration';

export function NotionIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useNotionIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.NOTION);
    const isPageConfig = input.configType === ConfigType.NOTION_PAGE;
    const currentConfig = input.config as NotionConfig | NotionPageConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(
        currentConfig, 
        [ConfigType.NOTION_DATABASE, ConfigType.NOTION_PAGE]
    );

    function onSelect(value: string) {
        const integration = integrations.find((integration: NotionIntegrationType) => integration.id === value);
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
                    Connect Notion
                </div>
            );
        }
        return (
            <div className="max-w-xs flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">
                    No Notion accounts connected
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Notion`}
                </Button>
            </div>
        );
    }

    const connectionSelections = integrations.map((integration: NotionIntegrationType) => ({
        label: integration.workspaceName || 'Unknown Workspace',
        value: integration.id
    }));

    let selectedOption = connectionSelections.find(option => option.value === currentConfig?.integrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0];
        setSelectedIntegrationId(defaultIntegration.value);
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0];
    }

    // Card variant: compact view
    if (variant === 'card') {
        const isComplete = currentConfig?.isComplete();
        if (!isComplete) {
            const needsDatabase = !isPageConfig && !(currentConfig as NotionConfig)?.databaseId;
            const needsPage = isPageConfig && !(currentConfig as NotionPageConfig)?.pageId;
            if (needsDatabase) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Select database
                    </div>
                );
            }
            if (needsPage) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Select page
                    </div>
                );
            }
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Select workspace
                </div>
            );
        }
        return (
            <div className="text-sm">
                {selectedOption ? selectedOption.label : 'No connection selected'}
            </div>
        );
    }

    const selectedResourceId = isPageConfig ? (currentConfig as NotionPageConfig)?.pageId : (currentConfig as NotionConfig)?.databaseId;

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.NOTION_DATABASE}/>
                </div>
                <div className="flex-1 min-w-0">
                    <DropdownSelect
                        statusOptions={connectionSelections}
                        selectedOption={selectedOption}
                        setSelected={onSelect}
                        additionalAction={{
                            label: 'Connect Another Notion',
                            onClick: connectOAuth
                        }}
                    />
                </div>
            </div>

            {/* Notion-specific resource selector */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border min-w-0 overflow-hidden">
                    {!selectedResourceId && (
                        <p className="text-sm text-muted-foreground mb-3">
                            Select a {isPageConfig ? 'page' : 'database'} to continue
                        </p>
                    )}
                    <NotionResourceSelector
                        integrationId={selectedIntegrationId || ''}
                        resourceType={isPageConfig ? 'page' : 'database'}
                        selectedResourceId={selectedResourceId}
                        onSelect={(resourceId: string, resourceName: string, resourceType: NotionResourceType) => {
                            if (resourceType === 'database') {
                                const updatedConfig = new NotionConfig(
                                    selectedIntegrationId || '',
                                    resourceId,
                                    resourceName
                                );
                                setConfig(updatedConfig);
                            } else if (resourceType === 'page') {
                                const updatedConfig = new NotionPageConfig(
                                    selectedIntegrationId || '',
                                    resourceId,
                                    resourceName
                                );
                                setConfig(updatedConfig);
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}


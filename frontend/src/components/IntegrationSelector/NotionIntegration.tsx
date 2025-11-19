import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { NotionResourceSelector } from '../NotionResourceSelector';
import { INTEGRATION_METADATA, IntegrationType, NotionIntegration as NotionIntegrationType } from "@/shared/Integrations"
import { NotionConfig, NotionPageConfig } from '../../shared/Configs';
import { NotionResourceType } from '@/shared/types';
import { BaseIntegrationProps } from './types';
import { useNotionIntegrations } from '@/hooks/api/useNotionIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';

interface NotionIntegrationProps extends BaseIntegrationProps {
    integrationType: IntegrationType;
    notionConfig?: NotionConfig;
    notionPageConfig?: NotionPageConfig;
    onNotionConfigChange?: (config: NotionConfig) => void;
    onNotionPageConfigChange?: (config: NotionPageConfig) => void;
}

export function NotionIntegration({
    selectedIntegrationId,
    onSelect,
    label = 'Connection',
    notionConfig,
    notionPageConfig,
    onNotionConfigChange,
    onNotionPageConfigChange,
    variant
}: NotionIntegrationProps) {
    const { integrations, isLoading } = useNotionIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.NOTION);
    const metadata = INTEGRATION_METADATA[IntegrationType.NOTION];

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
                    No {metadata.name} accounts connected
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect ${metadata.name}`}
                </Button>
            </div>
        );
    }

    const connectionSelections = integrations.map((integration: NotionIntegrationType) => ({
        label: integration.workspaceName || 'Unknown Workspace',
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
                {isOAuthConnecting ? 'Connecting...' : `Connect Another ${metadata.name}`}
            </Button>

            {/* Notion-specific database selector */}
            {selectedIntegrationId && (onNotionConfigChange || onNotionPageConfigChange) && (
                <div className="mt-3 pt-3 border-t border-border">
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
        </div>
    );
}


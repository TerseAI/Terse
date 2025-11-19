import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { FigmaFileSelector } from '../FigmaFileSelector';
import { INTEGRATION_METADATA, IntegrationType, FigmaIntegration as FigmaIntegrationType } from "@/shared/Integrations"
import { FigmaConfig } from '../../shared/Configs';
import { BaseIntegrationProps } from './types';
import { useFigmaIntegrations } from '@/hooks/api/useFigmaIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';

interface FigmaIntegrationProps extends BaseIntegrationProps {
    integrationType: IntegrationType;
    figmaConfig?: FigmaConfig;
    onFigmaConfigChange?: (config: FigmaConfig) => void;
}

export function FigmaIntegration({
    selectedIntegrationId,
    onSelect,
    label = 'Connection',
    figmaConfig,
    onFigmaConfigChange,
    variant
}: FigmaIntegrationProps) {
    const { integrations, isLoading } = useFigmaIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.FIGMA);
    const metadata = INTEGRATION_METADATA[IntegrationType.FIGMA];

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

    const connectionSelections = integrations.map((integration: FigmaIntegrationType) => ({
        label: integration.figma_user_id || 'Figma Account',
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

            {/* Figma-specific file selector */}
            {selectedIntegrationId && onFigmaConfigChange && (
                <div className="mt-3 pt-3 border-t border-border">
                    <FigmaFileSelector
                        selectedFileKey={figmaConfig?.fileKey}
                        selectedFileName={figmaConfig?.fileName}
                        selectedTeamId={figmaConfig?.teamId}
                        onSelect={(fileKey, fileName, teamId) => {
                            // Only update config if we have all required values
                            if (fileKey && teamId) {
                                onFigmaConfigChange({
                                    fileKey,
                                    fileName: fileName || fileKey, // Use fileKey as fallback if fileName is not provided
                                    teamId
                                });
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}


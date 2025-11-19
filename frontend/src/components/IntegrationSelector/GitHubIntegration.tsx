import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { INTEGRATION_METADATA, IntegrationType, GithubIntegration as GithubIntegrationType } from "@/shared/Integrations"
import { BaseIntegrationProps } from './types';
import { GithubResourceSelector } from '../GithubResourceSelector';
import { GitHubConfig } from '@/shared/Configs';
import { useGithubIntegrations } from '@/hooks/api/useGithubIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';

interface GitHubIntegrationProps extends BaseIntegrationProps {
    integrationType: IntegrationType;
    githubConfig?: GitHubConfig;
    onGithubConfigChange?: (config: GitHubConfig) => void;
}

export function GitHubIntegration({
    selectedIntegrationId,
    onSelect,
    label = 'Connection',
    variant,
    githubConfig,
    onGithubConfigChange
}: GitHubIntegrationProps) {
    const { integrations, isLoading } = useGithubIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.GITHUB);
    const metadata = INTEGRATION_METADATA[IntegrationType.GITHUB];

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

    const connectionSelections = integrations.map((integration: GithubIntegrationType) => ({
        label: integration.account_name || 'Unknown Account',
        value: integration.id
    }));
    const selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId) || connectionSelections[0];

    // Get connected repositories
    const connectedRepositories = githubConfig?.repositoryIds ? githubConfig.repositoryIds : [];
    
    // Find the selected integration to get its installation_id
    const selectedIntegration = selectedIntegrationId 
        ? integrations.find(i => i.id === selectedIntegrationId) 
        : null;

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

            {/* GitHub-specific repository selector */}
            {selectedIntegrationId && onGithubConfigChange && selectedIntegration && (
                <div className="mt-3 pt-3 border-t border-border">
                    <GithubResourceSelector
                        installationId={selectedIntegration.installation_id}
                        selectedRepositoryIds={connectedRepositories}
                        onSelect={(repositoryIds) => {
                            onGithubConfigChange({
                                ...githubConfig,
                                repositoryIds: repositoryIds
                            });
                        }}
                    />
                </div>
            )}
        </div>
    );
}


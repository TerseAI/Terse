import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { formatIntegrationDisplay, IntegrationInstance } from '../../utility/IntegrationFormatters';
import { getIntegrationName } from '../../utility/IntegrationUtils';
import { Integration } from "@/types/Integration";
import { BaseIntegrationProps } from './types';
import { GithubResourceSelector } from '../GithubResourceSelector';
import { GitHubConfig } from '@/shared/types';

interface GitHubIntegrationProps extends BaseIntegrationProps {
    integrationType: Integration;
    githubConfig?: GitHubConfig;
    onGithubConfigChange?: (config: GitHubConfig) => void;
}

export function GitHubIntegration({
    selectedIntegrationId,
    integrations,
    isLoading,
    isConnecting,
    onConnect,
    integrationType,
    variant,
    githubConfig,
    onGithubConfigChange
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

    // Get connected repositories
    const connectedRepositories = githubConfig?.repositoryIds ? githubConfig.repositoryIds : [];

    // Card variant: compact view
    if (variant === 'card') {
        return (
            <div className="text-sm truncate">
                {connectedRepositories.length > 0 ? `Connected to ${connectedRepositories.length} repository${connectedRepositories.length !== 1 ? 'ies' : ''}` : 'No repositories connected'}
            </div>
        );
    }
    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3">
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border">
                    <GithubResourceSelector
                        selectedRepositoryIds={githubConfig?.repositoryIds ? githubConfig.repositoryIds : []}
                        onSelect={(repositoryIds) => {
                            onGithubConfigChange?.({
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


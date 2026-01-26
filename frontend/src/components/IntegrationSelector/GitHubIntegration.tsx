import { Plus, AlertTriangleIcon, Info } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { IntegrationType, GithubIntegration as GithubIntegrationType } from "@/shared/Integrations"
import { InputConfigSelectorProps } from './types';
import { GithubResourceSelector } from '../GithubResourceSelector';
import { GitHubConfig } from '@/shared/Configs';
import { useGithubIntegrations } from '@/hooks/api/useGithubIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { StatusOption } from '../ui/DropdownSelect';
import { ConfigType } from '@/shared/Configs';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

export function GitHubIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useGithubIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.GITHUB>(IntegrationType.GITHUB, {});
    const currentConfig = input.config as GitHubConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.GITHUB);

    function onSelect(value: string) {
        const integration = integrations.find((integration: GithubIntegrationType) => integration.id === value);
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
                    Connect GitHub
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">
                    No GitHub integrations connected. Connect your GitHub account to access your repositories.
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect GitHub`}
                </Button>
            </div>
        );
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: GithubIntegrationType) => ({
        label: integration.account_name || 'Unknown Account',
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

    // Find the selected integration to get its installation_id
    const selectedIntegration = selectedIntegrationId 
        ? integrations.find(i => i.id === selectedIntegrationId) 
        : null;

    // Card variant: compact view
    if (variant === 'card') {
        const hasRepos = currentConfig?.repositoryIds && currentConfig.repositoryIds.length > 0;
        if (!hasRepos) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Select repositories
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
                    GitHub Account
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
                {isOAuthConnecting ? 'Connecting...' : "Connect Another GitHub"}
            </Button>

            {/* GitHub-specific repository selector */}
            {selectedIntegrationId && selectedIntegration && (
                <div className="mt-3 pt-3 border-t border-border">
                    <GithubResourceSelector
                        installationId={selectedIntegration.installation_id}
                        selectedRepositoryIds={currentConfig?.repositoryIds || []}
                        onSelect={(repositoryIds) => {
                            const updatedConfig = new GitHubConfig(
                                selectedIntegrationId,
                                repositoryIds
                            );
                            setConfig(updatedConfig);
                        }}
                        customLabel={
                            <div className="flex items-center gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">
                                    Select Repositories
                                </label>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                            onClick={(e) => e.preventDefault()}
                                        >
                                            <Info className="w-3.5 h-3.5" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                        <div className="flex flex-col gap-1.5">
                                            <p className="font-medium mb-1">Monitored GitHub Events</p>
                                            <p className="text-xs">
                                                We monitor the following events from your selected repositories:
                                            </p>
                                            <ul className="text-xs mt-1 space-y-0.5 list-disc list-inside">
                                                <li><strong>Push</strong> - Commits pushed to branches</li>
                                                <li><strong>Pull Request Opened</strong> - When a PR is created</li>
                                                <li><strong>Pull Request Updated</strong> - When a PR receives new commits</li>
                                                <li><strong>Pull Request Merged/Closed</strong> - When a PR is merged or closed</li>
                                                <li><strong>Issues Opened</strong> - When an issue is created</li>
                                            </ul>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        }
                    />
                </div>
            )}
        </div>
    );
}


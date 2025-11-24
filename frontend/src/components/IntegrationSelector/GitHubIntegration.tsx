import { Plus } from 'lucide-react';
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
import { useAuth } from '../../services/auth';

export function GitHubIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { loginWithGithub } = useAuth();
    const { integrations, isLoading } = useGithubIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection(IntegrationType.GITHUB);
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
        return (
            <div className="max-w-xs flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">
                    No GitHub accounts connected. If your repositories already have the app installed, you can connect your account to start using it.
                </div>
                <Button
                    onClick={loginWithGithub}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Account`}
                </Button>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Install GitHub App`}
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
                    />
                </div>
            )}
        </div>
    );
}


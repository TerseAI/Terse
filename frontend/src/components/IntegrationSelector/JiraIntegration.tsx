import { Plus, AlertTriangleIcon } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { AtlassianIntegration, IntegrationType } from "@/shared/Integrations"
import { JiraConfig } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useJiraIntegrations } from '@/hooks/api/useJiraIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { StatusOption } from '../ui/DropdownSelect';
import { useJiraResources } from '@/hooks/api/useJiraResources';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { useEffect } from 'react';
import { ConfigType } from '../../shared/Configs';
import { IconForConfigType } from '../../pages/Agents/components/Integration';

export function JiraIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useJiraIntegrations();
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.ATLASSIAN>(IntegrationType.ATLASSIAN, {});
    const currentConfig = input.config as JiraConfig | undefined;
    const [selectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.JIRA);

    // Fetch projects when an integration is selected
    const { projects, isLoading: isLoadingProjects } = useJiraResources(
        selectedIntegrationId || null
    );

    function onSelectIntegration(value: string) {
        const integration = integrations.find((integration: AtlassianIntegration) => integration.id === value);
        if (integration) {
            // Create a config with the integration but no project (listens to all projects)
            const jiraConfig = new JiraConfig(
                integration.id,
                undefined, // projectKey - undefined means listen to all projects
                undefined  // projectId - undefined means listen to all projects
            );
            setConfig(jiraConfig);
        }
    }

    function onSelectProject(projectKey: string, projectId: string) {
        if (selectedIntegrationId) {
            const jiraConfig = new JiraConfig(
                selectedIntegrationId,
                projectKey === "__none__" ? undefined : projectKey,
                projectId === "__none__" ? undefined : projectId
            );
            setConfig(jiraConfig);
        }
    }

    // Auto-select first integration if only one exists and no config yet
    useEffect(() => {
        if (integrations.length === 1 && !currentConfig?.integrationId && !isLoading) {
            const integration = integrations[0];
            const jiraConfig = new JiraConfig(integration.id);
            setConfig(jiraConfig);
        }
    }, [integrations, currentConfig, isLoading, setConfig]);

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
                    Connect Jira
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">
                    No Jira accounts connected
                </div>
                <Button
                    onClick={connectOAuth}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Jira`}
                </Button>
            </div>
        );
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: AtlassianIntegration) => ({
        label: integration.siteName || integration.baseUrl || 'Unknown Site',
        value: integration.id
    }));

    let selectedOption: StatusOption | undefined = connectionSelections.find(option => option.value === selectedIntegrationId);
    if (!selectedOption && connectionSelections.length == 1) {
        selectedOption = connectionSelections[0];
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
                    Select site
                </div>
            );
        }
        const projectDisplay = currentConfig?.projectKey 
            ? ` - ${currentConfig.projectKey}` 
            : ' - All Projects';
        return (
            <div className="text-sm">
                {selectedOption ? `${selectedOption.label}${projectDisplay}` : 'No connection selected'}
            </div>
        );
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.JIRA}/>
                </div>
                <div className="flex-1 min-w-0">
                    <DropdownSelect
                        statusOptions={connectionSelections}
                        selectedOption={selectedOption}
                        setSelected={onSelectIntegration}
                        placeholder="No connection selected"
                        additionalAction={{
                            label: 'Connect Another Jira',
                            onClick: connectOAuth
                        }}
                    />
                </div>
            </div>

            {/* Project selector - only show when an integration is selected */}
            {selectedIntegrationId && (
                <div className="flex flex-col gap-1.5 mt-2 pt-3 border-t border-border">
                    <label className="font-medium">
                        Project (Optional)
                    </label>
                    {isLoadingProjects ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                            Loading projects...
                        </div>
                    ) : (
                        <Select
                            onValueChange={(value) => {
                                if (value === "__none__") {
                                    onSelectProject("__none__", "__none__");
                                } else {
                                    const project = projects.find(p => p.key === value || p.id === value);
                                    if (project) {
                                        onSelectProject(project.key, project.id);
                                    }
                                }
                            }}
                            value={currentConfig?.projectKey || "__none__"}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All projects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">All projects</SelectItem>
                                {projects.map((project) => (
                                    <SelectItem key={project.id} value={project.key}>
                                        {project.name} ({project.key})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Select a specific project to filter events, or leave as "All projects" to listen to all projects
                    </p>
                </div>
            )}
        </div>
    );
}

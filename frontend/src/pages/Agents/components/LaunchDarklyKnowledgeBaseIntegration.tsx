import { LaunchDarklyConfig } from "@/shared/Configs";
import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector";
import { useLaunchdarklyIntegrations } from "@/hooks/api/useLaunchdarklyIntegrations";
import { BackendProvider } from "@/services/backend";
import { LaunchDarklyProject, LaunchDarklyEnvironment } from "@/shared/types";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Plus, AlertTriangleIcon, Eye, EyeOff, Info } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function LaunchDarklyKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading, mutate } = useLaunchdarklyIntegrations();
    const launchdarklyConfig = (knowledgeBase.config as LaunchDarklyConfig) || new LaunchDarklyConfig('', '', []);
    const selectedIntegrationId = launchdarklyConfig.integrationId || null;
    
    // Form state for connecting new integration
    const [showConnectForm, setShowConnectForm] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const projectKey = launchdarklyConfig.projectKey || '';
    const environmentKeys = launchdarklyConfig.environmentKeys || [];

    // Fetch projects when integration is selected
    const { data: projectsData, isLoading: isLoadingProjects } = useSWR(
        selectedIntegrationId ? ['launchdarkly-projects', selectedIntegrationId] : null,
        () => BackendProvider.getLaunchDarklyProjects(selectedIntegrationId!)
    );

    // Fetch environments when project is selected
    const { data: environmentsData, isLoading: isLoadingEnvironments } = useSWR(
        selectedIntegrationId && projectKey ? ['launchdarkly-environments', selectedIntegrationId, projectKey] : null,
        () => BackendProvider.getLaunchDarklyEnvironments(selectedIntegrationId!, projectKey)
    );


    const handleConnect = () => {
        setShowConnectForm(true);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await BackendProvider.createOrUpdateLaunchDarklyIntegration(apiKey);
            setShowConnectForm(false);
            setApiKey("");
            mutate(); // Refresh integrations list
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect LaunchDarkly integration");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setShowConnectForm(false);
        setApiKey("");
        setError(null);
    };

    // Handle project key change
    const handleProjectKeyChange = (value: string) => {
        // Clear environments when project changes
        const newConfig = new LaunchDarklyConfig(
            selectedIntegrationId || '',
            value,
            []
        );
        setConfig(newConfig);
    };

    // Handle environment key selection (multi-select)
    const handleEnvironmentKeysChange = (selectedKeys: string[]) => {
        const newConfig = new LaunchDarklyConfig(
            selectedIntegrationId || '',
            projectKey,
            selectedKeys
        );
        setConfig(newConfig);
    };

    if (isLoading) {
        return <Skeleton className="h-20 w-full" />;
    }

    // Card variant handling
    if (variant === 'card') {
        if (integrations.length === 0) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect LaunchDarkly
                </div>
            );
        }
        const hasConfig = !!launchdarklyConfig.projectKey && launchdarklyConfig.environmentKeys.length > 0;
        const displayText = hasConfig 
            ? `${launchdarklyConfig.projectKey} (${launchdarklyConfig.environmentKeys.length} env${launchdarklyConfig.environmentKeys.length !== 1 ? 's' : ''})`
            : (selectedIntegrationId ? 'Configure' : 'Select integration');
        return (
            <div className="text-xs text-center">
                {displayText}
            </div>
        );
    }

    // Dialog variant - no integrations and not showing form
    if (integrations.length === 0 && !showConnectForm) {
        return (
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">
                    No LaunchDarkly integrations connected. Connect your LaunchDarkly account to get started.
                </div>
                <Button onClick={handleConnect}>
                    <Plus className="w-4 h-4" />
                    Connect LaunchDarkly
                </Button>
            </div>
        );
    }

    // Show connect form
    if (showConnectForm) {
        return (
            <div className="space-y-4 p-4 rounded-lg border border-input bg-card">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="apiKey">API Key</Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <Info className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="flex flex-col gap-1">
                                        <span>Get your API key from LaunchDarkly</span>
                                        <a
                                            href="https://app.launchdarkly.com/settings/authorization"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline hover:no-underline"
                                        >
                                            Open API keys page
                                        </a>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="relative">
                            <Input
                                id="apiKey"
                                type={showApiKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your LaunchDarkly API key"
                                disabled={isSubmitting}
                                required
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                disabled={isSubmitting}
                            >
                                {showApiKey ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" disabled={isSubmitting || !apiKey}>
                            {isSubmitting ? "Connecting..." : "Connect"}
                        </Button>
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        );
    }

    const updateIntegrationId = (integrationId: string) => {
        // When changing integration, clear config
        const newConfig = new LaunchDarklyConfig(
            integrationId,
            '', // Clear project when integration changes
            [] // Clear environments when integration changes
        );
        setConfig(newConfig);
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>LaunchDarkly Integration</Label>
                <Select
                    value={selectedIntegrationId || ''}
                    onValueChange={updateIntegrationId}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an integration" />
                    </SelectTrigger>
                    <SelectContent>
                        {integrations.map((integration) => (
                            <SelectItem key={integration.id} value={integration.id}>
                                {integration.tokenName || integration.email || "LaunchDarkly"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button
                onClick={handleConnect}
                variant="outline"
                size="sm"
            >
                <Plus className="w-4 h-4" />
                Connect Another LaunchDarkly
            </Button>

            {/* Configuration fields - required */}
            {selectedIntegrationId && (
                <>
                    <div className="space-y-2">
                        <Label>Project <span className="text-destructive">*</span></Label>
                        {isLoadingProjects ? (
                            <Skeleton className="h-10 w-full" />
                        ) : (
                            <Select
                                value={projectKey}
                                onValueChange={handleProjectKeyChange}
                                disabled={isLoadingProjects}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a project" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projectsData?.projects.map((project: LaunchDarklyProject) => (
                                        <SelectItem key={project.key} value={project.key}>
                                            {project.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {!projectKey && !isLoadingProjects && (
                            <p className="text-sm text-muted-foreground">
                                Please select a project to continue
                            </p>
                        )}
                    </div>

                    {projectKey && (
                        <div className="space-y-2">
                            <Label>Environments <span className="text-destructive">*</span></Label>
                            {isLoadingEnvironments ? (
                                <Skeleton className="h-10 w-full" />
                            ) : (
                                <div className="space-y-2">
                                    {environmentsData?.environments.map((env: LaunchDarklyEnvironment) => {
                                        const isSelected = environmentKeys.includes(env.key);
                                        return (
                                            <div key={env.key} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={`env-${env.key}`}
                                                    checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            handleEnvironmentKeysChange([...environmentKeys, env.key]);
                                                        } else {
                                                            handleEnvironmentKeysChange(environmentKeys.filter(k => k !== env.key));
                                                        }
                                                    }}
                                                    className="h-4 w-4 rounded border-gray-300"
                                                />
                                                <label htmlFor={`env-${env.key}`} className="text-sm cursor-pointer">
                                                    {env.name}
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {environmentKeys.length === 0 && !isLoadingEnvironments && (
                                <p className="text-sm text-destructive">
                                    Please select at least one environment
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

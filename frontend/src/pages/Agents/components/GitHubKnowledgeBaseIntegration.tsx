import { AlertTriangleIcon, Plus } from "lucide-react"

import { GithubResourceSelector } from "@/components/GithubResourceSelector"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useGithubIntegrations } from "@/hooks/api/useGithubIntegrations"
import { useGithubResources } from "@/hooks/api/useGithubResources"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { GitHubKBConfig } from "@/shared/Configs"
import { IntegrationType } from "@/shared/Integrations"

import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector"

export function GitHubKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading } = useGithubIntegrations()
    const { connect: connectOAuth, isConnecting } = useOAuthConnection<IntegrationType.GITHUB>(IntegrationType.GITHUB, {})
    const githubConfig = (knowledgeBase.config as GitHubKBConfig) || new GitHubKBConfig("", [], [])
    const selectedIntegrationId = githubConfig.integrationId || null

    // Find the selected integration to get installationId for repository fetching
    const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId)
    const installationId = selectedIntegration?.installation_id ?? null

    // Fetch repositories for the selected integration
    const { repositories } = useGithubResources(installationId)

    if (isLoading) {
        return <Skeleton className="h-20 w-full" />
    }

    // Card variant handling
    if (variant === "card") {
        if (integrations.length === 0) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect GitHub
                </div>
            )
        }
        const hasRepos = githubConfig.repositoryIds.length > 0
        const displayText = hasRepos ? `${githubConfig.repositoryIds.length} repo${githubConfig.repositoryIds.length !== 1 ? "s" : ""}` : selectedIntegration ? "Select repos" : "Select integration"
        return <div className="text-xs text-center">{displayText}</div>
    }

    // Dialog variant - no integrations
    if (integrations.length === 0) {
        return (
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">No GitHub integrations connected. Connect your GitHub account to access your repositories.</div>
                <Button onClick={connectOAuth} disabled={isConnecting}>
                    <Plus className="w-4 h-4" />
                    {isConnecting ? "Connecting..." : "Connect GitHub"}
                </Button>
            </div>
        )
    }

    const updateIntegrationId = (integrationId: string) => {
        // When changing integration, clear repository selection
        const newConfig = new GitHubKBConfig(integrationId, [], [])
        setConfig(newConfig)
    }

    const updateRepositories = (repositoryIds: number[]) => {
        // Map repository IDs to their full names
        const repositoryNames = repositoryIds
            .map(id => {
                const repo = repositories.find(r => r.id === id)
                return repo ? `${repo.owner}/${repo.name}` : null
            })
            .filter((name): name is string => name !== null)

        const newConfig = new GitHubKBConfig(githubConfig.integrationId, repositoryIds, repositoryNames)
        setConfig(newConfig)
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>GitHub Integration</Label>
                <Select value={selectedIntegrationId || ""} onValueChange={updateIntegrationId}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an integration" />
                    </SelectTrigger>
                    <SelectContent>
                        {integrations.map(integration => (
                            <SelectItem key={integration.id} value={integration.id}>
                                {integration.account_name || `Installation ${integration.installation_id}`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button onClick={connectOAuth} disabled={isConnecting} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect Another GitHub"}
            </Button>

            {/* Repository selector - required */}
            {selectedIntegrationId && (
                <div className="space-y-2">
                    <Label>
                        Repositories <span className="text-destructive">*</span>
                    </Label>
                    <GithubResourceSelector installationId={installationId} selectedRepositoryIds={githubConfig.repositoryIds} onSelect={updateRepositories} />
                    {githubConfig.repositoryIds.length === 0 && <p className="text-sm text-muted-foreground">Please select at least one repository to continue</p>}
                </div>
            )}
        </div>
    )
}

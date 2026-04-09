import { AlertTriangleIcon, Plus } from "lucide-react"
import { GitHubConfig, GitHubEventType } from "terse-types/Configs"
import { ConfigType } from "terse-types/Configs"
import { GithubIntegration as GithubIntegrationType, IntegrationType } from "terse-types/Integrations"

import { useGithubIntegrations } from "@/hooks/api/useGithubIntegrations"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"

import { GithubResourceSelector } from "../GithubResourceSelector"
import DropdownSelect from "../ui/DropdownSelect"
import { StatusOption } from "../ui/DropdownSelect"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"

import { InputConfigSelectorProps } from "./types"

const GITHUB_EVENT_TYPES: { value: GitHubEventType; label: string; description: string }[] = [
    { value: GitHubEventType.PUSH, label: "Push", description: "Commits pushed to branches" },
    { value: GitHubEventType.PR_OPENED, label: "Pull Request Opened", description: "A pull request is created" },
    { value: GitHubEventType.PR_SYNCHRONIZE, label: "Pull Request Updated", description: "A pull request receives new commits" },
    { value: GitHubEventType.PR_MERGED, label: "Pull Request Merged", description: "A pull request is merged" },
    { value: GitHubEventType.PR_CLOSED, label: "Pull Request Closed", description: "A pull request is closed without merging" }
]

export function GitHubIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useGithubIntegrations()
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.GITHUB>(IntegrationType.GITHUB, {})
    const currentConfig = input.config as GitHubConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.GITHUB)

    function onSelect(value: string) {
        const integration = integrations.find((integration: GithubIntegrationType) => integration.id === value)
        if (integration) {
            setSelectedIntegrationId(integration.id)
            setConfig(new GitHubConfig(integration.id, currentConfig?.repositoryIds || [], currentConfig?.eventTypes || []))
        }
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        )
    }

    if (integrations.length === 0) {
        if (variant === "card") {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-warning" />
                    Connect GitHub
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No GitHub integrations connected. Connect your GitHub account to access your repositories.</div>
                <Button onClick={connectOAuth} disabled={isOAuthConnecting}>
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? "Connecting..." : `Connect GitHub`}
                </Button>
            </div>
        )
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: GithubIntegrationType) => ({
        label: integration.account_name || "Unknown Account",
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0]
        setSelectedIntegrationId(defaultIntegration.value)
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    // Find the selected integration to get its installation_id
    const selectedIntegration = selectedIntegrationId ? integrations.find(i => i.id === selectedIntegrationId) : null

    // Card variant: compact view
    if (variant === "card") {
        const hasRepos = currentConfig?.repositoryIds && currentConfig.repositoryIds.length > 0
        const hasEventTypes = (currentConfig?.eventTypes?.length ?? 0) > 0
        if (!hasRepos) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-warning" />
                    Select repositories
                </div>
            )
        }
        if (!hasEventTypes) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-warning" />
                    Select event types
                </div>
            )
        }
        return <div className="text-sm">{selectedOption ? selectedOption.label : "No connection selected"}</div>
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <label className="font-medium">GitHub Account</label>
                <DropdownSelect statusOptions={connectionSelections} selectedOption={selectedOption} setSelected={onSelect} placeholder="No connection selected" />
            </div>

            <Button onClick={connectOAuth} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another GitHub"}
            </Button>

            {/* GitHub-specific repository selector */}
            {selectedIntegrationId && selectedIntegration && (
                <div className="mt-3 pt-3 border-t border-border">
                    <GithubResourceSelector
                        installationId={selectedIntegration.installation_id}
                        selectedRepositoryIds={currentConfig?.repositoryIds || []}
                        onSelect={repositoryIds => {
                            const updatedConfig = new GitHubConfig(selectedIntegrationId, repositoryIds, currentConfig?.eventTypes || [])
                            setConfig(updatedConfig)
                        }}
                        customLabel={<label className="text-xs font-medium text-muted-foreground">Select Repositories</label>}
                    />
                    <div className="mt-4 space-y-4">
                        <div className="space-y-1">
                            <Label className="text-sm font-medium">Event Types</Label>
                            <p className="text-xs text-muted-foreground">Select the GitHub events that should trigger this agent.</p>
                        </div>
                        <div className="space-y-2">
                            {GITHUB_EVENT_TYPES.map(eventType => (
                                <label key={eventType.value} className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/50 cursor-pointer">
                                    <Checkbox
                                        checked={currentConfig?.eventTypes?.includes(eventType.value) || false}
                                        onCheckedChange={checked => {
                                            const nextEventTypes = checked
                                                ? [...(currentConfig?.eventTypes || []), eventType.value]
                                                : (currentConfig?.eventTypes || []).filter(type => type !== eventType.value)
                                            setConfig(new GitHubConfig(selectedIntegrationId, currentConfig?.repositoryIds || [], nextEventTypes))
                                        }}
                                        className="mt-0.5"
                                    />
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">{eventType.label}</div>
                                        <div className="text-xs text-muted-foreground">{eventType.description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

import { useEffect, useState } from "react"

import { ExternalLink, Github } from "lucide-react"
import { IntegrationType } from "terse-types/Integrations"
import { githubIntegrationsKey } from "terse-types/InvalidationKeys"
import { Repository } from "terse-types/types"

import DropdownSelect from "@/components/ui/DropdownSelect"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FadeSwitch } from "@/components/ui/fade-switch"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useOAuthConnection } from "@/modules/auth/hooks/useOAuthConnection"
import { useGithubIntegrations } from "@/modules/integrations/api/useGithubIntegrations"
import { useGithubResources } from "@/modules/integrations/api/useGithubResources"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"

// Number of repositories to show on the card before showing "View all" button
const REPOSITORY_DISPLAY_THRESHOLD = 3

function GithubIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.GITHUB>(IntegrationType.GITHUB, {}, stateToken)
    const { integrations, isLoading: isLoadingIntegrations } = useGithubIntegrations()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null)

    // Update selected installation when integrations are loaded
    useEffect(() => {
        if (integrations.length > 0 && selectedInstallationId === null) {
            setSelectedInstallationId(integrations[0].installation_id)
        }
    }, [integrations, selectedInstallationId])

    // Fetch repositories only for the selected installation
    const { repositories, isLoading: isLoadingRepositories } = useGithubResources(selectedInstallationId)

    const connectionSelections = integrations.map(integration => ({
        label: integration.account_name || "Unknown Account",
        value: integration.installation_id.toString()
    }))

    const selectedOption = connectionSelections.find(option => option.value === selectedInstallationId?.toString()) || connectionSelections[0]

    const handleInstallationChange = (value: string) => {
        const installationId = parseInt(value)
        if (!isNaN(installationId)) {
            setSelectedInstallationId(installationId)
        }
    }

    const isConnected = integrations.length > 0
    const summary = integrations[0]?.account_name || (repositories.length > 0 ? `${repositories.length} repositories` : undefined)

    if (compact) {
        return <CompactIntegrationRow integration={IntegrationType.GITHUB} isConnected={isConnected} summary={summary} connect={connect} isConnecting={isConnecting} className={className} />
    }

    return (
        <>
            <Card className={cn(className)}>
                <IntegrationCardHeader integration={IntegrationType.GITHUB} isActive={isActive} />
                <CardContent>
                    {isLoadingIntegrations ? (
                        <div className="space-y-3">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : integrations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                            <Github className="w-10 h-10 text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground">No GitHub integration connected</p>
                            <p className="text-xs text-muted-foreground mt-1">Connect your GitHub account</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <label className="text-sm font-medium mb-1.5 block">Connection</label>
                                <DropdownSelect statusOptions={connectionSelections} selectedOption={selectedOption} setSelected={handleInstallationChange} placeholder="No connection selected" />
                            </div>
                            <GithubCardContent repositories={repositories} isLoading={isLoadingRepositories} onViewAll={() => setIsDialogOpen(true)} />
                        </>
                    )}
                </CardContent>
                <IntegrationCardFooter
                    connect={connect}
                    isConnecting={isConnecting}
                    disconnect={isConnected ? { integrationType: IntegrationType.GITHUB, revalidateKeys: [githubIntegrationsKey()] } : undefined}
                />
            </Card>
            <RepositoriesDialog repositories={repositories} open={isDialogOpen} onOpenChange={setIsDialogOpen} />
        </>
    )
}

function GithubCardContent({ repositories, isLoading, onViewAll }: { repositories: Repository[]; isLoading: boolean; onViewAll: () => void }) {
    const displayRepos = repositories.slice(0, REPOSITORY_DISPLAY_THRESHOLD)
    const hasMore = repositories.length > REPOSITORY_DISPLAY_THRESHOLD
    const stateKey = isLoading ? "loading" : repositories.length === 0 ? "empty" : "repos"

    return (
        <FadeSwitch activeKey={stateKey}>
            {isLoading ? (
                <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : repositories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <Github className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">No GitHub repositories connected</p>
                    <p className="text-xs text-muted-foreground mt-1">Connect your GitHub repositories</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2 text-sm text-muted-foreground min-w-50">
                    <div className="font-semibold text-foreground">
                        {repositories.length} {repositories.length === 1 ? "repository" : "repositories"} connected
                    </div>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                        {displayRepos.map(repo => (
                            <li key={repo.id}>{repo.owner && repo.name ? `${repo.owner}/${repo.name}` : repo.name || "Unknown Repository"}</li>
                        ))}
                    </ul>
                    {hasMore && (
                        <Button variant="ghost" size="sm" onClick={onViewAll} className="w-fit h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                            View all {repositories.length} repositories
                        </Button>
                    )}
                </div>
            )}
        </FadeSwitch>
    )
}

function RepositoriesDialog({ repositories, open, onOpenChange }: { repositories: Repository[]; open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Connected Repositories</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-0">
                    {repositories.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4">No repositories connected</div>
                    ) : (
                        <ul className="space-y-2">
                            {repositories.map(repo => {
                                const repoName = repo.owner && repo.name ? `${repo.owner}/${repo.name}` : repo.name || "Unknown Repository"
                                const repoUrl = repo.owner && repo.name ? `https://github.com/${repo.owner}/${repo.name}` : null

                                return (
                                    <li key={repo.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                        <span className="text-sm font-medium text-foreground">{repoName}</span>
                                        {repoUrl && (
                                            <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default GithubIntegrationCard

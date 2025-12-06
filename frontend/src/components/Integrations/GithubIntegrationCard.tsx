import { useState, useEffect } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { IntegrationType } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthConnection } from "@/hooks/useOAuthConnection";
import { cn } from "@/lib/utils";
import { ExternalLink, Github } from "lucide-react";
import { useGithubIntegrations } from "@/hooks/api/useGithubIntegrations";
import { useGithubResources } from "@/hooks/api/useGithubResources";
import { Skeleton } from "../ui/skeleton";
import { Repository } from "@/shared/types";
import DropdownSelect from "../ui/DropdownSelect";

// Number of repositories to show on the card before showing "View all" button
const REPOSITORY_DISPLAY_THRESHOLD = 3;

function GithubIntegrationCard({ className, isActive = true }: { className?: string; isActive?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection(IntegrationType.GITHUB);
    const { integrations, isLoading: isLoadingIntegrations } = useGithubIntegrations();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedInstallationId, setSelectedInstallationId] = useState<number | null>(null);

    // Update selected installation when integrations are loaded
    useEffect(() => {
        if (integrations.length > 0 && selectedInstallationId === null) {
            setSelectedInstallationId(integrations[0].installation_id);
        }
    }, [integrations, selectedInstallationId]);

    // Fetch repositories only for the selected installation
    const { repositories, isLoading: isLoadingRepositories } = useGithubResources(selectedInstallationId);

    const connectionSelections = integrations.map((integration) => ({
        label: integration.account_name || 'Unknown Account',
        value: integration.installation_id.toString()
    }));

    const selectedOption = connectionSelections.find(
        option => option.value === selectedInstallationId?.toString()
    ) || connectionSelections[0];

    const handleInstallationChange = (value: string) => {
        const installationId = parseInt(value);
        if (!isNaN(installationId)) {
            setSelectedInstallationId(installationId);
        }
    };

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
                            <Github className="w-10 h-10 text-muted-foreground/50 mb-3" />
                            <p className="text-sm text-muted-foreground">No GitHub integration connected</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">Connect your GitHub account to get started</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4">
                                <label className="text-sm font-medium mb-1.5 block">Connection</label>
                                <DropdownSelect
                                    statusOptions={connectionSelections}
                                    selectedOption={selectedOption}
                                    setSelected={handleInstallationChange}
                                    placeholder="No connection selected"
                                />
                            </div>
                            <GithubCardContent 
                                repositories={repositories} 
                                isLoading={isLoadingRepositories} 
                                onViewAll={() => setIsDialogOpen(true)} 
                            />
                        </>
                    )}
                </CardContent>
                <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
            </Card>
            <RepositoriesDialog 
                repositories={repositories} 
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
            />
        </>
    )
}

function GithubCardContent({ repositories, isLoading, onViewAll }: { repositories: Repository[], isLoading: boolean, onViewAll: () => void }) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    if (repositories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Github className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No GitHub repositories connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your GitHub repositories to get started</p>
            </div>
        );
    }

    // Show first N repos on the card, with a button to view all if there are more
    const displayRepos = repositories.slice(0, REPOSITORY_DISPLAY_THRESHOLD);
    const hasMore = repositories.length > REPOSITORY_DISPLAY_THRESHOLD;

    return (
        <div className="flex flex-col gap-2 text-sm text-muted-foreground min-w-50">
            <div className="font-semibold text-foreground">
                {repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'} connected
            </div>
            <ul className="list-disc list-inside space-y-1 ml-2">
                {displayRepos.map((repo) => (
                    <li key={repo.id}>
                        {repo.owner && repo.name 
                            ? `${repo.owner}/${repo.name}`
                            : repo.name || 'Unknown Repository'}
                    </li>
                ))}
            </ul>
            {hasMore && (
                <Button variant="ghost" size="sm" onClick={onViewAll} className="w-fit h-auto p-0 text-xs text-muted-foreground hover:text-foreground">
                    View all {repositories.length} repositories
                </Button>
            )}
        </div>
    )
}

function RepositoriesDialog({ 
    repositories, 
    open, 
    onOpenChange 
}: { 
    repositories: Repository[], 
    open: boolean, 
    onOpenChange: (open: boolean) => void 
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Connected Repositories</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-0">
                    {repositories.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-4">
                            No repositories connected
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {repositories.map((repo) => {
                                const repoName = repo.owner && repo.name 
                                    ? `${repo.owner}/${repo.name}`
                                    : repo.name || 'Unknown Repository';
                                const repoUrl = repo.owner && repo.name
                                    ? `https://github.com/${repo.owner}/${repo.name}`
                                    : null;

                                return (
                                    <li 
                                        key={repo.id} 
                                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                    >
                                        <span className="text-sm font-medium text-foreground">
                                            {repoName}
                                        </span>
                                        {repoUrl && (
                                            <a
                                                href={repoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default GithubIntegrationCard;


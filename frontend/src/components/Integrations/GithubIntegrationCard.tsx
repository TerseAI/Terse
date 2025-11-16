import { useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Integration } from "@/types/Integration";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus, GithubIntegration } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

// Number of repositories to show on the card before showing "View all" button
const REPOSITORY_DISPLAY_THRESHOLD = 3;

function GithubIntegrationCard({ integrationStatus, className, integrationId: _integrationId }: { integrationStatus: IntegrationsStatus, integrationId: string, className?: string }) {
    const oauthUrl = useOAuthUrl(Integration.GITHUB);
    const githubInstances = getIntegrationInstances(integrationStatus.integrations, Integration.GITHUB);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <>
            <Card className={cn(className)}>
                <IntegrationCardHeader integration={Integration.GITHUB} />
                <CardContent>
                    <GithubCardContent repositories={githubInstances} onViewAll={() => setIsDialogOpen(true)} />
                </CardContent>
                <IntegrationCardFooter oauthUrl={oauthUrl} />
            </Card>
            <RepositoriesDialog 
                repositories={githubInstances} 
                open={isDialogOpen} 
                onOpenChange={setIsDialogOpen} 
            />
        </>
    )
}

function GithubCardContent({ repositories, onViewAll }: { repositories: GithubIntegration[], onViewAll: () => void }) {
    if (repositories.length === 0) {
        return (
            <div className="flex items-center gap-4 text-sm text-muted-foreground min-w-50">
                <span>No repositories connected</span>
            </div>
        )
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
                        {repo.owner && repo.repositoryName 
                            ? `${repo.owner}/${repo.repositoryName}`
                            : repo.repositoryName || 'Unknown Repository'}
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
    repositories: GithubIntegration[], 
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
                                const repoName = repo.owner && repo.repositoryName 
                                    ? `${repo.owner}/${repo.repositoryName}`
                                    : repo.repositoryName || 'Unknown Repository';
                                const repoUrl = repo.owner && repo.repositoryName
                                    ? `https://github.com/${repo.owner}/${repo.repositoryName}`
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


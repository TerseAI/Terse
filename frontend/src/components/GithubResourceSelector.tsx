import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { useGithubResources } from "@/hooks/api/useGithubResources";
import { MultiSelect } from "./MultiSelect";

interface GithubResourceSelectorProps {
    installationId: number | null | undefined;
    selectedRepositoryIds?: number[];
    onSelect: (repositoryIds: number[]) => void;
}

export function GithubResourceSelector({
    installationId,
    selectedRepositoryIds = [],
    onSelect
}: GithubResourceSelectorProps) {
    const { repositories, isLoading, isError, error, isValidating, mutate } = useGithubResources(installationId);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await mutate();
        } finally {
            setIsRefreshing(false);
        }
    };

    const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Failed to load repositories');

    if (!installationId) {
        return (
            <div className="text-sm text-muted-foreground">
                Please select a GitHub connection to view repositories.
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="text-sm text-muted-foreground">
                Loading repositories...
            </div>
        );
    }

    if (isError) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-destructive">{errorMessage}</div>
                <Button
                    onClick={handleRefresh}
                    variant="link"
                    size="sm"
                    className="text-xs h-auto p-0"
                >
                    Try again
                </Button>
            </div>
        );
    }

    if (repositories.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                No GitHub repositories found. Make sure your GitHub integration has access to repositories.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                    Select Repositories
                </label>
                <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing || isValidating}
                    variant="ghost"
                    size="sm"
                    title="Refresh repository list"
                >
                    <RefreshCw className={`w-3 h-3 mr-1 ${(isRefreshing || isValidating) ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            <MultiSelect
                options={repositories.map((repo) => ({
                    id: repo.id,
                    label: `${repo.owner}/${repo.name}`,
                }))}
                selectedIds={selectedRepositoryIds}
                onSelect={(ids) => onSelect(ids as number[])}
                placeholder="Select repositories..."
                searchPlaceholder="Search repositories..."
                emptyMessage="No repositories found."
                displayText={(count) =>
                    count > 0
                        ? `${count} repositor${count !== 1 ? 'ies' : 'y'} selected`
                        : "Select repositories..."
                }
            />
            {repositories.length > 0 && (
                <div className="text-xs text-muted-foreground">
                    {repositories.length} repository{repositories.length !== 1 ? 'ies' : ''} available
                </div>
            )}
        </div>
    );
}
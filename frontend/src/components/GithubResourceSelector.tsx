import { useState } from "react";
import { Repository } from "../shared/types";
import { Check, ChevronsUpDown, RefreshCw, X } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { useGithubResources } from "@/hooks/api/useGithubResources";

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
            <GithubResourceCombobox 
                repositories={repositories} 
                selectedRepositoryIds={selectedRepositoryIds} 
                onSelect={onSelect} 
            />
            {repositories.length > 0 && (
                <div className="text-xs text-muted-foreground">
                    {repositories.length} repository{repositories.length !== 1 ? 'ies' : ''} available
                </div>
            )}
        </div>
    );
}

interface GithubResourceComboboxProps {
    repositories: Repository[];
    selectedRepositoryIds: number[];
    onSelect: (repositoryIds: number[]) => void;
}

function GithubResourceCombobox({
    repositories,
    selectedRepositoryIds,
    onSelect
}: GithubResourceComboboxProps) {
    const [open, setOpen] = useState(false);

    const selectedRepositories = repositories.filter((repo) => 
        selectedRepositoryIds.includes(repo.id)
    );

    const handleToggleRepository = (repositoryId: number) => {
        const isSelected = selectedRepositoryIds.includes(repositoryId);
        if (isSelected) {
            onSelect(selectedRepositoryIds.filter(id => id !== repositoryId));
        } else {
            onSelect([...selectedRepositoryIds, repositoryId]);
        }
    };

    const handleRemoveRepository = (repositoryId: number) => {
        onSelect(selectedRepositoryIds.filter(id => id !== repositoryId));
    };

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        <span className="truncate">
                            {selectedRepositories.length > 0
                                ? `${selectedRepositories.length} repositor${selectedRepositories.length !== 1 ? 'ies' : 'y'} selected`
                                : "Select repositories..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search repositories..." />
                        <CommandList>
                            <CommandEmpty>No repositories found.</CommandEmpty>
                            <CommandGroup>
                                {repositories.map((repository) => {
                                    const isSelected = selectedRepositoryIds.includes(repository.id);
                                    return (
                                        <CommandItem
                                            key={repository.id}
                                            value={`${repository.id}-${repository.owner}-${repository.name}`}
                                            onSelect={() => {
                                                handleToggleRepository(repository.id);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    isSelected ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className="truncate">
                                                {repository.owner}/{repository.name}
                                            </span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selectedRepositories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedRepositories.map((repository) => (
                        <Badge
                            key={repository.id}
                            variant="secondary"
                            className="pr-1"
                        >
                            <span className="truncate max-w-[200px]">
                                {repository.owner}/{repository.name}
                            </span>
                            <button
                                onClick={() => handleRemoveRepository(repository.id)}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleRemoveRepository(repository.id);
                                    }
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}
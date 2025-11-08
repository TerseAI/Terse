import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { ConfluencePage, ConfluenceResourcesResponse } from "../shared/types";
import { Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { cn } from "@/lib/utils";

interface ConfluenceResourceSelectorProps {
    integrationId: string;
    selectedResourceId?: string;
    onSelect: (resourceId: string, resourceTitle: string) => void;
}

export function ConfluenceResourceSelector({
    integrationId,
    selectedResourceId,
    onSelect
}: ConfluenceResourceSelectorProps) {
    const [resources, setResources] = useState<ConfluencePage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchResources = async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const response: ConfluenceResourcesResponse = await BackendProvider.getConfluenceResources(integrationId);
            setResources(response.resources);

            // Only auto-select if no resource is currently selected
            if (!selectedResourceId && response.resources.length > 0) {
                const resourceToSelect = response.resources[0];
                if (resourceToSelect) {
                    onSelect(resourceToSelect.id, resourceToSelect.title);
                }
            }
        } catch (err: any) {
            console.error('Error fetching Confluence resources:', err);
            setError(err.message || 'Failed to load resources');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (integrationId) {
            fetchResources();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [integrationId]);

    const handleRefresh = () => {
        fetchResources(true);
    };

    if (isLoading) {
        return (
            <div className="text-sm text-muted-foreground">
                Loading resources...
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-destructive">{error}</div>
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

    if (resources.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                No Confluence resources found. Make sure your Confluence integration has access to resources.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                    Select Resource
                </label>
                <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    variant="ghost"
                    size="sm"
                    title="Refresh resource list"
                >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            <ConfluenceResourceCombobox resources={resources} selectedResourceId={selectedResourceId || ''} onSelect={onSelect} />
            {resources.length > 0 && (
                <div className="text-xs text-muted-foreground">
                    {resources.length} resource{resources.length !== 1 ? 's' : ''} available
                </div>
            )}
        </div>
    );
}


interface ConfluenceResourceComboboxProps {
    resources: ConfluencePage[];
    selectedResourceId: string;
    onSelect: (resourceId: string, resourceTitle: string) => void;
}
function ConfluenceResourceCombobox({
    resources,
    selectedResourceId,
    onSelect
}: ConfluenceResourceComboboxProps) {
    const [open, setOpen] = useState(false)

    const selectedResource = resources.find((resource) => resource.id === selectedResourceId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {selectedResource
                        ? selectedResource.title
                        : "Select resource..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search resources..." />
                    <CommandList>
                        <CommandEmpty>No resources found.</CommandEmpty>
                        <CommandGroup>
                            {resources.map((resource) => {
                                const isSelected = selectedResourceId === resource.id;
                                return (
                                    <CommandItem
                                        key={resource.id}
                                        value={`${resource.id}-${resource.title}`}
                                        onSelect={() => {
                                            onSelect(resource.id, resource.title);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                isSelected ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span>{resource.title}</span>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}


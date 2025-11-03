import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { NotionResource, NotionResourcesResponse, NotionResourceType } from "../shared/types";
import { Check, ChevronsUpDown, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { cn } from "@/lib/utils";

interface NotionDatabaseSelectorProps {
    integrationId: string;
    selectedDatabaseId?: string;
    onSelect: (resourceId: string, resourceName: string, resourceType: NotionResourceType) => void;
}

export function NotionDatabaseSelector({
    integrationId,
    selectedDatabaseId,
    onSelect
}: NotionDatabaseSelectorProps) {
    const [resources, setResources] = useState<NotionResource[]>([]);
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
            const response: NotionResourcesResponse = await BackendProvider.getNotionResources(integrationId);
            setResources(response.resources);

            // Only auto-select if no resource is currently selected
            if (!selectedDatabaseId && response.resources.length > 0) {
                // Try to use the connection's default resource first
                let resourceToSelect: NotionResource | undefined;
                if (response.selectedResourceId) {
                    resourceToSelect = response.resources.find(resource => resource.id === response.selectedResourceId);
                }
                // Fall back to first database if no default is available
                if (!resourceToSelect) {
                    resourceToSelect = response.resources[0];
                }
                if (resourceToSelect) {
                    onSelect(resourceToSelect.id, resourceToSelect.title, resourceToSelect.type);
                }
            }
        } catch (err: any) {
            console.error('Error fetching Notion databases:', err);
            setError(err.message || 'Failed to load databases');
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
                Loading databases...
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
                No Notion Pages or Databases found. Make sure your Notion integration has access to pages and databases.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                    Select Page or Database
                </label>
                <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    variant="ghost"
                    size="sm"
                    title="Refresh database list"
                >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            <NotionResourceCombobox resources={resources} selectedResourceId={selectedDatabaseId || ''} onSelect={onSelect} />
            {resources.length > 0 && (
                <div className="text-xs text-muted-foreground">
                    {resources.length} page{resources.length !== 1 ? 's' : ''} or database{resources.length !== 1 ? 's' : ''} available
                </div>
            )}
        </div>
    );
}


interface NotionResourceComboboxProps {
    resources: NotionResource[];
    selectedResourceId: string;
    onSelect: (resourceId: string, resourceName: string, resourceType: NotionResourceType) => void;
}
function NotionResourceCombobox({
    resources,
    selectedResourceId,
    onSelect
}: NotionResourceComboboxProps) {
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
                        ? `${selectedResource.type === 'database' ? 'Database' : 'Page'} - ${selectedResource.title}`
                        : "Select page or database..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search pages or databases..." />
                    <CommandList>
                        <CommandEmpty>No pages or databases found.</CommandEmpty>
                        <CommandGroup>
                            {resources.map((resource) => {
                                const isSelected = selectedResourceId === resource.id;
                                return (
                                    <CommandItem
                                        key={resource.id}
                                        value={`${resource.id}-${resource.title}`}
                                        onSelect={() => {
                                            onSelect(resource.id, resource.title, resource.type);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                isSelected ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span>{resource.type === 'database' ? 'Database' : 'Page'} - {resource.title}</span>
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
import { useState } from "react";
import { NotionResource, NotionResourceType } from "../shared/types";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { cn } from "@/lib/utils";
import { useNotionResources } from "@/hooks/api/useNotionResources";
import { RefreshButton } from "./RefreshButton";

interface NotionResourceSelectorProps {
    integrationId: string;
    selectedResourceId?: string;
    resourceType: NotionResourceType;
    onSelect: (resourceId: string, resourceName: string, resourceType: NotionResourceType) => void;
}

export function NotionResourceSelector({
    integrationId,
    selectedResourceId,
    resourceType,
    onSelect
}: NotionResourceSelectorProps) {
    const {
        resources,
        isLoading,
        isError,
        error,
        isValidating,
        mutate,
    } = useNotionResources(integrationId, resourceType);

    const [isExplicitlyRefreshing, setIsExplicitlyRefreshing] = useState(false);

    // Only show spinner when explicitly refreshing (user clicked button) AND currently validating
    const isRefreshing = isExplicitlyRefreshing && isValidating;

    const handleRefresh = () => {
        setIsExplicitlyRefreshing(true);
        void mutate().finally(() => {
            setIsExplicitlyRefreshing(false);
        });
    };

    if (isLoading) {
        return (
            <div className="text-sm text-muted-foreground">
                Loading databases...
            </div>
        );
    }

    if (isError && error) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-destructive">{error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Failed to load databases')}</div>
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
                {resources.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                        {resources.length} page{resources.length !== 1 ? 's' : ''} or database{resources.length !== 1 ? 's' : ''} available
                    </div>
                )}
                <RefreshButton
                    onClick={handleRefresh}
                    isRefreshing={isRefreshing}
                    title="Refresh database list"
                />
            </div>
            <NotionResourceCombobox resources={resources} selectedResourceId={selectedResourceId || ''} onSelect={onSelect} />
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
            <PopoverContent className="p-0" align="start">
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
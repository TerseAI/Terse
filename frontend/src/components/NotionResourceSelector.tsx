import { useEffect, useMemo, useState } from "react";
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
    onSelect: (resourceId: string, resourceName: string, resourceType: NotionResourceType) => void;
}

export function NotionResourceSelector({
    integrationId,
    selectedResourceId,
    onSelect
}: NotionResourceSelectorProps) {
    const {
        resources,
        selectedResourceId: defaultResourceId,
        isLoading,
        isError,
        error,
        isValidating,
        mutate,
    } = useNotionResources(integrationId);

    const isRefreshing = isValidating && !isLoading;

    const errorMessage = useMemo(() => {
        if (!isError) {
            return null;
        }
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Failed to load databases';
    }, [error, isError]);

    useEffect(() => {
        if (!integrationId || isLoading || resources.length === 0) {
            return;
        }

        if (selectedResourceId) {
            return;
        }

        let resourceToSelect: NotionResource | undefined;

        if (defaultResourceId) {
            resourceToSelect = resources.find((resource) => resource.id === defaultResourceId);
        }

        if (!resourceToSelect) {
            resourceToSelect = resources[0];
        }

        if (resourceToSelect) {
            onSelect(resourceToSelect.id, resourceToSelect.title, resourceToSelect.type);
        }
    }, [defaultResourceId, integrationId, isLoading, onSelect, resources, selectedResourceId]);

    const handleRefresh = () => {
        void mutate();
    };

    if (isLoading) {
        return (
            <div className="text-sm text-muted-foreground">
                Loading databases...
            </div>
        );
    }

    if (errorMessage) {
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
                <RefreshButton
                    onClick={handleRefresh}
                    isRefreshing={isRefreshing}
                    title="Refresh database list"
                />
            </div>
            <NotionResourceCombobox resources={resources} selectedResourceId={selectedResourceId || ''} onSelect={onSelect} />
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
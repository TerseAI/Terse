import { useCallback, useEffect, useState } from "react"

import { Check, ChevronsUpDown, DatabaseIcon, FileIcon, Loader2 } from "lucide-react"

import { useNotionResources } from "@/hooks/api/useNotionResources"
import { cn } from "@/lib/utils"

import { NotionResource, NotionResourceType } from "../shared/types"

import { Button } from "./ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

interface NotionResourceSelectorProps {
    integrationId: string
    selectedResourceId?: string
    selectedResourceName?: string
    resourceType: NotionResourceType
    onSelect: (resourceId: string, resourceName: string, resourceType: NotionResourceType) => void
}

export function NotionResourceSelector({ integrationId, selectedResourceId, selectedResourceName, resourceType, onSelect }: NotionResourceSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchInput, setSearchInput] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")

    const label = resourceType === "database" ? "database" : "page"
    const icon = resourceType === "database" ? <DatabaseIcon className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchInput])

    const { resources, isLoading, isError, error, isValidating } = useNotionResources(integrationId, debouncedSearch, resourceType)

    const handleSelect = useCallback(
        (resource: NotionResource) => {
            onSelect(resource.id, resource.title, resource.type)
            setOpen(false)
            setSearchInput("")
        },
        [onSelect]
    )

    // Show loading when initial load or when search is being debounced/fetched
    const isSearching = searchInput !== debouncedSearch || isValidating

    return (
        <div className="space-y-2 min-w-0 overflow-hidden">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                        {selectedResourceId && selectedResourceName ? (
                            <span className="flex items-center gap-2 min-w-0 overflow-hidden">
                                {icon}
                                <span className="truncate">{selectedResourceName}</span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Select {label}...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput placeholder={`Search ${label}s...`} value={searchInput} onValueChange={setSearchInput} />
                        <CommandList>
                            {isLoading && !isSearching && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                                    <p>Loading {label}s...</p>
                                </div>
                            )}
                            {isSearching && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                                    <p>Searching...</p>
                                </div>
                            )}
                            {!isLoading && !isSearching && isError && (
                                <div className="py-6 text-center text-sm text-destructive">{error instanceof Error ? error.message : `Failed to load ${label}s`}</div>
                            )}
                            {!isLoading && !isSearching && !isError && resources.length === 0 && (
                                <CommandEmpty>{debouncedSearch ? `No ${label}s found for "${debouncedSearch}"` : `No ${label}s available`}</CommandEmpty>
                            )}
                            {!isLoading && !isSearching && !isError && resources.length > 0 && (
                                <CommandGroup heading={`${resources.length} ${label}${resources.length !== 1 ? "s" : ""}`}>
                                    {resources.map(resource => {
                                        const isSelected = selectedResourceId === resource.id
                                        return (
                                            <CommandItem key={resource.id} value={`${resource.id}-${resource.title}`} onSelect={() => handleSelect(resource)}>
                                                <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                                <span className="flex items-center gap-2 min-w-0 overflow-hidden">
                                                    <span className="shrink-0">{icon}</span>
                                                    <span className="truncate">{resource.title}</span>
                                                </span>
                                            </CommandItem>
                                        )
                                    })}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    )
}

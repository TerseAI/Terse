import { useCallback, useEffect, useState } from "react"

import { Check, ChevronsUpDown, FileText, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

import { useConfluenceResources } from "../hooks/api/useConfluenceResources"
import { ConfluencePage } from "../shared/types"

import { Button } from "./ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

interface ConfluenceResourceSelectorProps {
    integrationId: string
    selectedResourceId?: string
    selectedResourceName?: string
    onSelect: (resourceId: string, resourceTitle: string, spaceId: string, spaceName: string) => void
}

export function ConfluenceResourceSelector({ integrationId, selectedResourceId, selectedResourceName, onSelect }: ConfluenceResourceSelectorProps) {
    const [open, setOpen] = useState(false)
    const [searchInput, setSearchInput] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchInput])

    const { resources, isLoading, isError, error, isValidating } = useConfluenceResources(integrationId, debouncedSearch)

    const handleSelect = useCallback(
        (resource: ConfluencePage) => {
            onSelect(resource.id, resource.title, resource.spaceId, resource.spaceName)
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
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="truncate">{selectedResourceName}</span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Select page...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput placeholder="Search pages..." value={searchInput} onValueChange={setSearchInput} />
                        <CommandList>
                            {isLoading && !isSearching && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                                    <p>Loading pages...</p>
                                </div>
                            )}
                            {isSearching && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                                    <p>Searching...</p>
                                </div>
                            )}
                            {!isLoading && !isSearching && isError && (
                                <div className="py-6 text-center text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load pages"}</div>
                            )}
                            {!isLoading && !isSearching && !isError && resources.length === 0 && (
                                <CommandEmpty>{debouncedSearch ? `No pages found for "${debouncedSearch}"` : "No pages available"}</CommandEmpty>
                            )}
                            {!isLoading && !isSearching && !isError && resources.length > 0 && (
                                <CommandGroup heading={`${resources.length} page${resources.length !== 1 ? "s" : ""}`}>
                                    {resources.map(resource => {
                                        const isSelected = selectedResourceId === resource.id
                                        return (
                                            <CommandItem key={resource.id} value={`${resource.id}-${resource.title}`} onSelect={() => handleSelect(resource)}>
                                                <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                                <div className="flex flex-col min-w-0 overflow-hidden">
                                                    <span className="truncate">{resource.title}</span>
                                                    {resource.spaceName && <span className="text-xs text-muted-foreground truncate">{resource.spaceName}</span>}
                                                </div>
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

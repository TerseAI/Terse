import { useCallback, useEffect, useState } from "react"

import { Check, ChevronsUpDown, DatabaseIcon, FileIcon, Loader2, X } from "lucide-react"

import { useNotionResources } from "@/hooks/api/useNotionResources"
import { cn } from "@/lib/utils"

import { NotionResource, NotionResourceType } from "../shared/types"

import { Button } from "./ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

/** Single-select: choose one resource; onSelect closes the popover. */
interface SingleSelectProps {
    integrationId: string
    resourceType: NotionResourceType
    selectedResourceId?: string
    selectedResourceName?: string
    onSelect: (resourceId: string, resourceName: string, resourceType: NotionResourceType) => void
    selectedResourceIds?: never
    selectedResourceNames?: never
    onAdd?: never
    onRemove?: never
}

/** Multi-select: selected on top with remove; search below to add; onAdd does not close popover. */
interface MultiSelectProps {
    integrationId: string
    resourceType: NotionResourceType
    selectedResourceIds: string[]
    selectedResourceNames: string[]
    onAdd: (resourceId: string, resourceName: string) => void
    onRemove: (resourceId: string) => void
    selectedResourceId?: never
    selectedResourceName?: never
    onSelect?: never
}

type NotionResourceSelectorProps = SingleSelectProps | MultiSelectProps

function isMultiSelect(props: NotionResourceSelectorProps): props is MultiSelectProps {
    return "onAdd" in props && props.onAdd != null
}

export function NotionResourceSelector(props: NotionResourceSelectorProps) {
    const { integrationId, resourceType } = props
    const multi = isMultiSelect(props)
    const [open, setOpen] = useState(false)
    const [searchInput, setSearchInput] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")

    const label = resourceType === "database" ? "database" : "page"
    const icon = resourceType === "database" ? <DatabaseIcon className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
        return () => clearTimeout(timer)
    }, [searchInput])

    const { resources, isLoading, isError, error, isValidating } = useNotionResources(integrationId, debouncedSearch, resourceType)

    const selectedIds = multi ? props.selectedResourceIds : props.selectedResourceId ? [props.selectedResourceId] : []
    const excludeIds = multi ? selectedIds : []

    const handleSelect = useCallback(
        (resource: NotionResource) => {
            if (multi) {
                props.onAdd(resource.id, resource.title)
                setSearchInput("")
            } else {
                props.onSelect(resource.id, resource.title, resource.type)
                setOpen(false)
                setSearchInput("")
            }
        },
        [multi, props]
    )

    const isSearching = searchInput !== debouncedSearch || isValidating
    const searchableResources = multi ? resources.filter(r => !excludeIds.includes(r.id)) : resources

    const triggerLabel = multi
        ? (props.selectedResourceIds.length > 0
              ? `${props.selectedResourceIds.length} ${label}${props.selectedResourceIds.length !== 1 ? "s" : ""} selected`
              : `Select ${label}s...`)
        : (props.selectedResourceId && props.selectedResourceName
              ? props.selectedResourceName
              : `Select ${label}...`)

    return (
        <div className="space-y-2 min-w-0 overflow-hidden">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                        <span className="flex items-center gap-2 min-w-0 overflow-hidden">
                            {icon}
                            <span className={cn("truncate", !multi && !props.selectedResourceId && "text-muted-foreground")}>{triggerLabel}</span>
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command shouldFilter={false}>
                        {multi && props.selectedResourceIds.length > 0 && (
                            <div className="border-b border-border px-2 py-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Selected</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {props.selectedResourceIds.map((id, i) => (
                                        <span
                                            key={id}
                                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
                                        >
                                            <span className="shrink-0">{icon}</span>
                                            <span className="truncate max-w-[140px]">{props.selectedResourceNames[i] ?? id}</span>
                                            <button
                                                type="button"
                                                className="shrink-0 rounded p-0.5 hover:bg-muted-foreground/20"
                                                onClick={() => props.onRemove(id)}
                                                aria-label={`Remove ${props.selectedResourceNames[i] ?? id}`}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <CommandInput placeholder={`Search to add ${label}s...`} value={searchInput} onValueChange={setSearchInput} />
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
                            {!isLoading && !isSearching && !isError && searchableResources.length === 0 && (
                                <CommandEmpty>{debouncedSearch ? `No ${label}s found for "${debouncedSearch}"` : multi && excludeIds.length > 0 ? "All available selected" : `No ${label}s available`}</CommandEmpty>
                            )}
                            {!isLoading && !isSearching && !isError && searchableResources.length > 0 && (
                                <CommandGroup heading={multi ? "Search to add" : `${searchableResources.length} ${label}${searchableResources.length !== 1 ? "s" : ""}`}>
                                    {searchableResources.map(resource => {
                                        const isSelected = !multi && selectedIds.includes(resource.id)
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

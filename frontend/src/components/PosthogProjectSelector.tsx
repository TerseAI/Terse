import { useCallback, useEffect, useState } from "react"

import { Check, ChevronsUpDown, FolderIcon, Loader2 } from "lucide-react"

import { usePosthogProjects } from "@/hooks/api/usePosthogProjects"
import { cn } from "@/lib/utils"

import { PosthogProject } from "../shared/types"

import { Button } from "./ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"

interface PosthogProjectSelectorProps {
    integrationId: string
    selectedProjectId?: string
    selectedProjectName?: string
    onSelect: (projectId: string, projectName: string) => void
}

export function PosthogProjectSelector({ integrationId, selectedProjectId, selectedProjectName, onSelect }: PosthogProjectSelectorProps) {
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

    const { projects, isLoading, isError, error, isValidating } = usePosthogProjects(integrationId, debouncedSearch)

    const handleSelect = useCallback(
        (project: PosthogProject) => {
            onSelect(project.id, project.name)
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
                        {selectedProjectId && selectedProjectName ? (
                            <span className="flex items-center gap-2 min-w-0 overflow-hidden">
                                <FolderIcon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{selectedProjectName}</span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground">Select project...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput placeholder="Search projects..." value={searchInput} onValueChange={setSearchInput} />
                        <CommandList>
                            {isLoading && !isSearching && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                                    <p>Loading projects...</p>
                                </div>
                            )}
                            {isSearching && (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" />
                                    <p>Searching...</p>
                                </div>
                            )}
                            {!isLoading && !isSearching && isError && (
                                <div className="py-6 text-center text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load projects"}</div>
                            )}
                            {!isLoading && !isSearching && !isError && projects.length === 0 && (
                                <CommandEmpty>{debouncedSearch ? `No projects found for "${debouncedSearch}"` : "No projects available"}</CommandEmpty>
                            )}
                            {!isLoading && !isSearching && !isError && projects.length > 0 && (
                                <CommandGroup heading={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}>
                                    {projects.map(project => {
                                        const isSelected = selectedProjectId === project.id
                                        return (
                                            <CommandItem key={project.id} value={`${project.id}-${project.name}`} onSelect={() => handleSelect(project)}>
                                                <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                                <span className="flex items-center gap-2 min-w-0 overflow-hidden">
                                                    <FolderIcon className="h-4 w-4 shrink-0" />
                                                    <span className="truncate">{project.name}</span>
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

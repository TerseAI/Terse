import { useCallback, useEffect, useMemo, useState } from "react"

import { DatabaseIcon, FileIcon, LayoutGrid, Loader2, Search, X } from "lucide-react"

import { useNotionResources } from "@/hooks/api/useNotionResources"
import { cn } from "@/lib/utils"
import type { NotionResource, NotionResourceType } from "@/shared/types"

import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

export type NotionScopeItem = { id: string; name: string }

export interface NotionScopePickerProps {
    integrationId: string
    selectedDatabaseIds: string[]
    selectedDatabaseNames: string[]
    selectedPageIds: string[]
    selectedPageNames: string[]
    onConfirm: (databases: NotionScopeItem[], pages: NotionScopeItem[]) => void
}

const TAB_TYPE_MAP = {
    all: undefined as NotionResourceType | undefined,
    databases: "database" as const,
    pages: "page" as const
}

export function NotionScopePicker({ integrationId, selectedDatabaseIds, selectedDatabaseNames, selectedPageIds, selectedPageNames, onConfirm }: NotionScopePickerProps) {
    const [tab, setTab] = useState<"all" | "databases" | "pages">("all")
    const [searchInput, setSearchInput] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")

    const [localDatabases, setLocalDatabases] = useState<NotionScopeItem[]>([])
    const [localPages, setLocalPages] = useState<NotionScopeItem[]>([])

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchInput), 300)
        return () => clearTimeout(timer)
    }, [searchInput])

    useEffect(() => {
        setLocalDatabases(
            (selectedDatabaseIds ?? []).map((id, i) => ({
                id,
                name: selectedDatabaseNames[i] ?? id
            }))
        )
        setLocalPages(
            (selectedPageIds ?? []).map((id, i) => ({
                id,
                name: selectedPageNames[i] ?? id
            }))
        )
    }, [selectedDatabaseIds, selectedDatabaseNames, selectedPageIds, selectedPageNames])

    const typeFilter = TAB_TYPE_MAP[tab]
    const { resources, isLoading, isError, error, isValidating } = useNotionResources(integrationId, debouncedSearch, typeFilter)

    const selectedIds = useMemo(() => new Set([...localDatabases.map(d => d.id), ...localPages.map(p => p.id)]), [localDatabases, localPages])

    const isSelected = useCallback((resource: NotionResource) => selectedIds.has(resource.id), [selectedIds])

    const applySelection = useCallback(
        (databases: NotionScopeItem[], pages: NotionScopeItem[]) => {
            onConfirm(databases, pages)
        },
        [onConfirm]
    )

    const toggleResource = useCallback(
        (resource: NotionResource) => {
            if (resource.type === "database") {
                const next = localDatabases.some(d => d.id === resource.id) ? localDatabases.filter(d => d.id !== resource.id) : [...localDatabases, { id: resource.id, name: resource.title }]
                setLocalDatabases(next)
                applySelection(next, localPages)
            } else {
                const next = localPages.some(p => p.id === resource.id) ? localPages.filter(p => p.id !== resource.id) : [...localPages, { id: resource.id, name: resource.title }]
                setLocalPages(next)
                applySelection(localDatabases, next)
            }
        },
        [localDatabases, localPages, applySelection]
    )

    const removeDatabase = useCallback(
        (id: string) => {
            const next = localDatabases.filter(d => d.id !== id)
            setLocalDatabases(next)
            applySelection(next, localPages)
        },
        [localDatabases, localPages, applySelection]
    )

    const removePage = useCallback(
        (id: string) => {
            const next = localPages.filter(p => p.id !== id)
            setLocalPages(next)
            applySelection(localDatabases, next)
        },
        [localDatabases, localPages, applySelection]
    )

    const selectedCount = localDatabases.length + localPages.length
    const isSearching = searchInput !== debouncedSearch || isValidating

    const resourceList = (
        <ScrollArea className="h-[220px] w-full min-w-0 rounded-md border border-border">
            <div className="w-full min-w-0 overflow-x-hidden">
            {isLoading && !isSearching && (
                <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                    Loading...
                </div>
            )}
            {isSearching && (
                <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mb-2 h-5 w-5 animate-spin" />
                    Searching...
                </div>
            )}
            {!isLoading && !isSearching && isError && <div className="py-4 text-center text-sm text-destructive">{error instanceof Error ? error.message : "Failed to load resources"}</div>}
            {!isLoading && !isSearching && !isError && resources.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">{debouncedSearch ? `No pages or databases match "${debouncedSearch}"` : "No pages or databases available"}</div>
            )}
            {!isLoading && !isSearching && !isError && resources.length > 0 && (
                <div className="min-w-0 overflow-hidden p-1">
                    {resources.map(resource => {
                        const checked = isSelected(resource)
                        const isDb = resource.type === "database"
                        return (
                            <label key={resource.id} className={cn("flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 min-w-0 hover:bg-muted/50", "focus-within:bg-muted/50")}>
                                <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleResource(resource)}
                                    className="mt-0.5 shrink-0"
                                    aria-label={`${isDb ? "Database" : "Page"}: ${resource.title}`}
                                />
                                <span className="flex shrink-0 pt-0.5">
                                    {isDb ? (
                                        <DatabaseIcon className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </span>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                    <span className="block min-w-0 max-w-full truncate text-sm font-medium" title={resource.title}>{resource.title}</span>
                                </div>
                            </label>
                        )
                    })}
                </div>
            )}
            </div>
        </ScrollArea>
    )

    return (
        <div className="w-full min-w-0 overflow-hidden">
            <Tabs value={tab} onValueChange={v => setTab(v as "all" | "databases" | "pages")}>
                <TabsList className="w-full min-w-0" variant="line">
                    <TabsTrigger value="all" variant="line" className="flex-1 px-2 py-1.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                    <LayoutGrid className="h-4 w-4" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>All</TooltipContent>
                        </Tooltip>
                    </TabsTrigger>
                    <TabsTrigger value="databases" variant="line" className="flex-1 px-2 py-1.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                    <DatabaseIcon className="h-4 w-4" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>Databases</TooltipContent>
                        </Tooltip>
                    </TabsTrigger>
                    <TabsTrigger value="pages" variant="line" className="flex-1 px-2 py-1.5">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center justify-center">
                                    <FileIcon className="h-4 w-4" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>Pages</TooltipContent>
                        </Tooltip>
                    </TabsTrigger>
                </TabsList>

                <div className="relative mt-2 min-w-0">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 shrink-0 text-muted-foreground" />
                    <Input
                        placeholder="Search pages & databases..."
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        className="h-8 pl-8 min-w-0"
                        aria-label="Search pages and databases"
                    />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Databases include all sub-pages.</p>

                <TabsContent value="all" className="mt-2 min-w-0">
                    {resourceList}
                </TabsContent>
                <TabsContent value="databases" className="mt-2 min-w-0">
                    {resourceList}
                </TabsContent>
                <TabsContent value="pages" className="mt-2 min-w-0">
                    {resourceList}
                </TabsContent>
            </Tabs>

            {selectedCount > 0 && (
                <div className="mt-3 min-w-0 space-y-1.5 border-t border-border pt-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Selected ({selectedCount})</p>
                    <div className="flex min-w-0 flex-wrap gap-1.5 overflow-hidden">
                        {localDatabases.map(({ id, name }) => (
                            <span key={id} className="inline-flex max-w-56 items-center gap-1 overflow-hidden rounded-md border border-border bg-muted/50 px-2 py-0.5 text-sm min-w-0">
                                <DatabaseIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 truncate" title={name}>{name}</span>
                                <button type="button" className="shrink-0 rounded p-0.5 hover:bg-muted" onClick={() => removeDatabase(id)} aria-label={`Remove ${name}`}>
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                        {localPages.map(({ id, name }) => (
                            <span key={id} className="inline-flex max-w-56 items-center gap-1 overflow-hidden rounded-md border border-border bg-muted/50 px-2 py-0.5 text-sm min-w-0">
                                <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 truncate" title={name}>{name}</span>
                                <button type="button" className="shrink-0 rounded p-0.5 hover:bg-muted" onClick={() => removePage(id)} aria-label={`Remove ${name}`}>
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

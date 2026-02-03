import { useState } from "react"

import { Check, ChevronsUpDown, Users } from "lucide-react"

import { useLinearTeams } from "@/hooks/api/useLinearTeams"
import { cn } from "@/lib/utils"
import { LinearTeam } from "@/shared/types"

import { RefreshButton } from "../RefreshButton"
import { Button } from "../ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

interface LinearTeamSelectorProps {
    integrationId: string
    selectedTeamId?: string
    onSelect: (teamId: string, teamName: string) => void
}

export function LinearTeamSelector({ integrationId, selectedTeamId, onSelect }: LinearTeamSelectorProps) {
    const { teams, isLoading, isError, error, isValidating, mutate } = useLinearTeams(integrationId)

    const [isExplicitlyRefreshing, setIsExplicitlyRefreshing] = useState(false)

    // Only show spinner when explicitly refreshing (user clicked button) AND currently validating
    const isRefreshing = isExplicitlyRefreshing && isValidating

    const handleRefresh = () => {
        setIsExplicitlyRefreshing(true)
        void mutate().finally(() => {
            setIsExplicitlyRefreshing(false)
        })
    }

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading teams...</div>
    }

    if (isError && error) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-destructive">{error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to load teams"}</div>
                <Button onClick={handleRefresh} variant="link" size="sm" className="text-xs h-auto p-0">
                    Try again
                </Button>
            </div>
        )
    }

    if (teams.length === 0) {
        return <div className="text-sm text-muted-foreground">No Linear teams found. Make sure your Linear integration has access to teams.</div>
    }

    return (
        <div className="space-y-2 min-w-0 overflow-hidden">
            <div className="flex items-center justify-between">
                {teams.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                        {teams.length} team{teams.length !== 1 ? "s" : ""} available
                    </div>
                )}
                <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} title="Refresh team list" />
            </div>
            <LinearTeamCombobox teams={teams} selectedTeamId={selectedTeamId || ""} onSelect={onSelect} />
        </div>
    )
}

interface LinearTeamComboboxProps {
    teams: LinearTeam[]
    selectedTeamId: string
    onSelect: (teamId: string, teamName: string) => void
}
function LinearTeamCombobox({ teams, selectedTeamId, onSelect }: LinearTeamComboboxProps) {
    const [open, setOpen] = useState(false)

    const selectedTeam = teams.find(team => team.id === selectedTeamId)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {selectedTeam ? (
                        <span className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <Users className="h-4 w-4 shrink-0" />
                            <span className="truncate">{selectedTeam.name}</span>
                        </span>
                    ) : (
                        "Select team..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search teams..." />
                    <CommandList>
                        <CommandEmpty>No teams found.</CommandEmpty>
                        <CommandGroup>
                            {teams.map(team => {
                                const isSelected = selectedTeamId === team.id
                                return (
                                    <CommandItem
                                        key={team.id}
                                        value={`${team.id}-${team.name}`}
                                        onSelect={() => {
                                            onSelect(team.id, team.name)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                                        <span className="flex items-center gap-2 min-w-0 overflow-hidden">
                                            <Users className="h-4 w-4 shrink-0" />
                                            <span className="truncate">{team.name}</span>
                                            <span className="text-xs text-muted-foreground">({team.key})</span>
                                        </span>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

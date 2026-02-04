import { AlertTriangleIcon, Plus } from "lucide-react"

import { useLinearIntegrations } from "@/hooks/api/useLinearIntegrations"
import { useLinearTeams } from "@/hooks/api/useLinearTeams"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { LinearKBConfig } from "@/shared/Configs"
import { IntegrationType, LinearIntegration as LinearIntegrationType } from "@/shared/Integrations"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector"

export function LinearKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading } = useLinearIntegrations()
    const { connect: connectOAuth, isConnecting } = useOAuthConnection<IntegrationType.LINEAR>(IntegrationType.LINEAR, {})
    const linearConfig = (knowledgeBase.config as LinearKBConfig) || new LinearKBConfig("")
    const selectedIntegrationId = linearConfig.integrationId || null

    const { teams, isLoading: teamsLoading } = useLinearTeams(selectedIntegrationId)

    if (isLoading) {
        return <Skeleton className="h-20 w-full" />
    }

    if (variant === "card") {
        if (integrations.length === 0) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Linear
                </div>
            )
        }
        const displayText = linearConfig.teamName
            ? `${linearConfig.teamName}`
            : linearConfig.integrationId
              ? "Linear connected"
              : "Select workspace"
        return <div className="text-xs text-center">{displayText}</div>
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">No Linear workspaces connected. Connect Linear to search and read tickets.</div>
                <Button onClick={connectOAuth} disabled={isConnecting}>
                    <Plus className="w-4 h-4" />
                    {isConnecting ? "Connecting..." : "Connect Linear"}
                </Button>
            </div>
        )
    }

    const updateIntegrationId = (integrationId: string) => {
        setConfig(new LinearKBConfig(integrationId))
    }

    const updateTeam = (teamId: string) => {
        if (teamId === "__ALL__") {
            setConfig(new LinearKBConfig(linearConfig.integrationId, undefined, undefined))
            return
        }
        const team = teams?.find(t => t.id === teamId)
        setConfig(new LinearKBConfig(linearConfig.integrationId, teamId, team?.name))
    }

    const connectionSelections = integrations.map((integration: LinearIntegrationType) => ({
        label: integration.workspaceName || "Unknown workspace",
        value: integration.id,
    }))

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Linear workspace</Label>
                <Select value={linearConfig.integrationId || ""} onValueChange={updateIntegrationId}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select workspace" />
                    </SelectTrigger>
                    <SelectContent>
                        {connectionSelections.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedIntegrationId && (
                <div className="space-y-2">
                    <Label>Team (optional)</Label>
                    <Select
                        value={linearConfig.teamId || "__ALL__"}
                        onValueChange={updateTeam}
                        disabled={teamsLoading}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="All teams" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__ALL__">All teams</SelectItem>
                            {teams?.map(team => (
                                <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <Button onClick={connectOAuth} disabled={isConnecting} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect another workspace"}
            </Button>
        </div>
    )
}

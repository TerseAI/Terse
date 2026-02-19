import { AlertTriangleIcon, CheckIcon } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkOSIntegrations } from "@/hooks/api/useWorkOSIntegrations"
import { WorkOSKBConfig } from "@/shared/Configs"

import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector"

export function WorkOSKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading } = useWorkOSIntegrations()
    const workosConfig = knowledgeBase.config as WorkOSKBConfig | undefined
    const selectedIntegrationId = workosConfig?.integrationId || null

    if (isLoading) {
        return <Skeleton className="h-20 w-full" />
    }

    if (variant === "card") {
        if (integrations.length === 0) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect WorkOS
                </div>
            )
        }
        if (!selectedIntegrationId) {
            return <div className="text-xs text-center">Select integration</div>
        }
        const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId)
        const envLabel = selectedIntegration?.environment ? ` (${selectedIntegration.environment})` : ""
        return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckIcon className="size-3 text-green-600" />
                WorkOS{envLabel}
            </div>
        )
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">No WorkOS integrations connected. Connect your WorkOS account in the Integrations settings first.</div>
            </div>
        )
    }

    const handleIntegrationChange = (integrationId: string) => {
        setConfig(new WorkOSKBConfig(integrationId))
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>WorkOS Integration</Label>
                <Select value={selectedIntegrationId || ""} onValueChange={handleIntegrationChange}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an integration" />
                    </SelectTrigger>
                    <SelectContent>
                        {integrations.map(integration => {
                            const envLabel = integration.environment ? ` (${integration.environment})` : ""
                            return (
                                <SelectItem key={integration.id} value={integration.id}>
                                    WorkOS{envLabel}
                                </SelectItem>
                            )
                        })}
                    </SelectContent>
                </Select>
            </div>

            <p className="text-xs text-muted-foreground">
                This knowledge base gives the agent access to fetch and search users from your WorkOS account.
            </p>

            {selectedIntegrationId && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
                    <CheckIcon className="size-3" />
                    Integration connected
                </div>
            )}
        </div>
    )
}

import { AlertTriangleIcon } from "lucide-react"

import { useWorkOSIntegrations } from "@/hooks/api/useWorkOSIntegrations"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { ConfigType, WorkOSOutputConfig } from "@/shared/Configs"
import { WorkOSIntegration as WorkOSIntegrationType } from "@/shared/Integrations"

import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

import { InputConfigSelectorProps } from "./types"

function formatWorkOSIntegrationLabel(integration: WorkOSIntegrationType): string {
    return integration.environment ? `WorkOS (${integration.environment})` : "WorkOS"
}

export function WorkOSOutputIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useWorkOSIntegrations()
    const currentConfig = input.config as WorkOSOutputConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.WORKOS_OUTPUT)

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading connections...</div>
    }

    if (integrations.length === 0) {
        if (variant === "card") {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect WorkOS
                </div>
            )
        }

        return <p className="text-sm text-muted-foreground">No WorkOS integration connected. Connect your WorkOS account in the Integrations settings first.</p>
    }

    let effectiveIntegrationId = currentConfig?.integrationId || selectedIntegrationId
    if (!effectiveIntegrationId && integrations.length === 1) {
        const defaultIntegration = integrations[0]
        effectiveIntegrationId = defaultIntegration.id
        setSelectedIntegrationId(defaultIntegration.id)
        setConfig(new WorkOSOutputConfig(defaultIntegration.id))
    }

    const selectedIntegration = integrations.find(integration => integration.id === effectiveIntegrationId)

    if (variant === "card") {
        if (!currentConfig?.integrationId) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Configure
                </div>
            )
        }

        return <div className="text-sm">{selectedIntegration ? formatWorkOSIntegrationLabel(selectedIntegration) : "WorkOS connected"}</div>
    }

    const handleSelectIntegration = (integrationId: string) => {
        setSelectedIntegrationId(integrationId)
        setConfig(new WorkOSOutputConfig(integrationId))
    }

    return (
        <div className="space-y-2">
            <Label>WorkOS Integration</Label>
            <Select value={effectiveIntegrationId || ""} onValueChange={handleSelectIntegration}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a WorkOS integration" />
                </SelectTrigger>
                <SelectContent>
                    {integrations.map(integration => (
                        <SelectItem key={integration.id} value={integration.id}>
                            {formatWorkOSIntegrationLabel(integration)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

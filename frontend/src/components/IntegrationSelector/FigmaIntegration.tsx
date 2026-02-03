import { AlertTriangleIcon, Plus } from "lucide-react"

import { useFigmaIntegrations } from "@/hooks/api/useFigmaIntegrations"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { FigmaIntegration as FigmaIntegrationType, IntegrationType } from "@/shared/Integrations"

import { FigmaConfig } from "../../shared/Configs"
import { ConfigType } from "../../shared/Configs"
import { FigmaFileSelector } from "../FigmaFileSelector"
import DropdownSelect from "../ui/DropdownSelect"
import { StatusOption } from "../ui/DropdownSelect"
import { Button } from "../ui/button"

import { InputConfigSelectorProps } from "./types"

export function FigmaIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useFigmaIntegrations()
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.FIGMA>(IntegrationType.FIGMA, {})
    const currentConfig = input.config as FigmaConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.FIGMA)

    function onSelect(value: string) {
        const integration = integrations.find((integration: FigmaIntegrationType) => integration.id === value)
        if (integration) {
            setSelectedIntegrationId(integration.id)
        }
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        )
    }

    if (integrations.length === 0) {
        if (variant === "card") {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Figma
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No Figma accounts connected</div>
                <Button onClick={connectOAuth} disabled={isOAuthConnecting}>
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? "Connecting..." : `Connect Figma`}
                </Button>
            </div>
        )
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: FigmaIntegrationType) => ({
        label: integration.handle || integration.figma_user_id || "Figma Account",
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0]
        setSelectedIntegrationId(defaultIntegration.value)
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    // Card variant: compact view
    if (variant === "card") {
        const isComplete = currentConfig?.isComplete()
        if (!isComplete) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Select file
                </div>
            )
        }
        return <div className="text-sm">{selectedOption ? selectedOption.label : "No connection selected"}</div>
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <label className="font-medium">Figma Account</label>
                <DropdownSelect statusOptions={connectionSelections} selectedOption={selectedOption} setSelected={onSelect} placeholder="No connection selected" />
            </div>

            <Button onClick={connectOAuth} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Figma"}
            </Button>

            {/* Figma-specific file selector */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border">
                    {!currentConfig?.isComplete() && <p className="text-sm text-muted-foreground mb-3">Select a Figma file to continue</p>}
                    <FigmaFileSelector
                        selectedFileKey={currentConfig?.fileKey}
                        selectedFileName={currentConfig?.fileName}
                        selectedTeamId={currentConfig?.teamId}
                        onSelect={(fileKey, fileName, teamId) => {
                            // Only update config if we have all required values
                            if (fileKey && teamId) {
                                const updatedConfig = new FigmaConfig(selectedIntegrationId, fileKey, fileName || fileKey, teamId)
                                setConfig(updatedConfig)
                            }
                        }}
                    />
                </div>
            )}
        </div>
    )
}

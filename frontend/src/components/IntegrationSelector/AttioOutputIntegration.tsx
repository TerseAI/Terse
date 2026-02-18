import { AlertTriangleIcon, Plus } from "lucide-react"

import { useAttioIntegrations } from "@/hooks/api/useAttioIntegrations"
import { useAttioObjects } from "@/hooks/api/useAttioObjects"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { AttioIntegration as AttioIntegrationType, IntegrationType } from "@/shared/Integrations"

import { IconForConfigType } from "../../pages/Agents/components/Integration"
import { AttioOutputConfig, ConfigType } from "../../shared/Configs"
import DropdownSelect from "../ui/DropdownSelect"
import { Button } from "../ui/button"

import { InputConfigSelectorProps } from "./types"

export function AttioOutputIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useAttioIntegrations()
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.ATTIO>(IntegrationType.ATTIO, {})
    const currentConfig = input.config as AttioOutputConfig | undefined
    const [selectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.ATTIO_OUTPUT)
    const { objects, isLoading: isLoadingObjects } = useAttioObjects(selectedIntegrationId)

    function onSelectIntegration(value: string) {
        const integration = integrations.find((i: AttioIntegrationType) => i.id === value)
        if (integration) {
            const attioConfig = new AttioOutputConfig(integration.id, currentConfig?.objectSlug)
            setConfig(attioConfig)
        }
    }

    function onSelectObject(value: string) {
        if (selectedIntegrationId) {
            const attioConfig = new AttioOutputConfig(selectedIntegrationId, value)
            setConfig(attioConfig)
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
                    Connect Attio
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No Attio workspaces connected</div>
                <Button onClick={connectOAuth} disabled={isOAuthConnecting}>
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? "Connecting..." : "Connect Attio"}
                </Button>
            </div>
        )
    }

    const connectionSelections = integrations.map((integration: AttioIntegrationType) => ({
        label: integration.workspaceName || "Attio Workspace",
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === currentConfig?.integrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length === 1) {
        const defaultIntegration = connectionSelections[0]
        setConfig(new AttioOutputConfig(defaultIntegration.value, currentConfig?.objectSlug))
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    // Card variant: compact view
    if (variant === "card") {
        const hasConfig = !!currentConfig && !!currentConfig.integrationId
        const needsObject = !currentConfig?.objectSlug
        const isComplete = hasConfig && !needsObject
        if (!isComplete) {
            if (!hasConfig) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Configure
                    </div>
                )
            }
            if (needsObject) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Select object
                    </div>
                )
            }
        }
        return <div className="text-sm">{currentConfig?.objectSlug || selectedOption?.label || "No connection selected"}</div>
    }

    // Object selector options
    const objectSelections = objects.map(obj => ({
        label: obj.plural_noun || obj.api_slug,
        value: obj.api_slug
    }))

    const selectedObjectOption = objectSelections.find(option => option.value === currentConfig?.objectSlug)

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.ATTIO_OUTPUT} />
                </div>
                <div className="flex-1 min-w-0">
                    <DropdownSelect
                        statusOptions={connectionSelections}
                        selectedOption={selectedOption}
                        setSelected={onSelectIntegration}
                        placeholder="No connection selected"
                        additionalAction={{
                            label: "Connect Another Attio",
                            onClick: connectOAuth
                        }}
                    />
                </div>
            </div>

            {/* Object selector */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border min-w-0 overflow-hidden">
                    {!currentConfig?.objectSlug && <p className="text-sm text-muted-foreground mb-3">Select an object type to continue</p>}
                    {isLoadingObjects ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                            Loading objects...
                        </div>
                    ) : (
                        <DropdownSelect statusOptions={objectSelections} selectedOption={selectedObjectOption || null} setSelected={onSelectObject} placeholder="Select an object type" />
                    )}
                </div>
            )}

            <Button onClick={connectOAuth} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Attio"}
            </Button>
        </div>
    )
}

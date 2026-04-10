import { AlertTriangleIcon, Plus } from "lucide-react"
import { ConfigType, LinearEventType, LinearInputConfig } from "terse-types"
import { IntegrationType, LinearIntegration as LinearIntegrationType } from "terse-types/Integrations"

import { useLinearIntegrations } from "@/hooks/api/useLinearIntegrations"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"

import { IconForConfigType } from "../../pages/Agents/components/Integration"
import DropdownSelect from "../ui/DropdownSelect"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"

import { InputConfigSelectorProps } from "./types"

const LINEAR_EVENT_TYPES: { value: LinearEventType; label: string; description: string }[] = [
    { value: LinearEventType.ISSUE_CREATED, label: "Issue Created", description: "A new Linear issue is created" },
    { value: LinearEventType.ISSUE_UPDATED, label: "Issue Updated", description: "An existing Linear issue is updated" },
    { value: LinearEventType.COMMENT_CREATED, label: "Comment Created", description: "A comment is added to a Linear issue" }
]

export function LinearInputIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useLinearIntegrations()
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.LINEAR>(IntegrationType.LINEAR, {})
    const currentConfig = input.config as LinearInputConfig | undefined
    const [selectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.LINEAR_INPUT)

    function onSelect(value: string) {
        const integration = integrations.find((integration: LinearIntegrationType) => integration.id === value)
        if (integration) {
            // Preserve existing team and project when switching integrations
            const linearConfig = new LinearInputConfig(integration.id, currentConfig?.projectId, currentConfig?.projectName, currentConfig?.eventTypes)
            setConfig(linearConfig)
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
                    <AlertTriangleIcon className="size-3 text-warning" />
                    Connect Linear
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No Linear accounts connected</div>
                <Button onClick={connectOAuth} disabled={isOAuthConnecting}>
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? "Connecting..." : `Connect Linear`}
                </Button>
            </div>
        )
    }

    const connectionSelections = integrations.map((integration: LinearIntegrationType) => ({
        label: integration.workspaceName || "Unknown Team",
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === currentConfig?.integrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0]
        setConfig(new LinearInputConfig(defaultIntegration.value, currentConfig?.projectId, currentConfig?.projectName))
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    // Card variant: compact view
    if (variant === "card") {
        const hasConfig = !!currentConfig && !!currentConfig.integrationId
        const isComplete = hasConfig && (currentConfig?.eventTypes?.length ?? 0) > 0
        if (!isComplete) {
            if (!hasConfig) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-warning" />
                        Configure
                    </div>
                )
            }
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-warning" />
                    Configure
                </div>
            )
        }
        return <div className="text-sm">{selectedOption?.label || "No connection selected"}</div>
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center mb-2">
                <div className="w-15 h-15">
                    <IconForConfigType type={ConfigType.LINEAR_INPUT} />
                </div>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                    placeholder="No connection selected"
                    additionalAction={{
                        label: "Connect Another Linear",
                        onClick: connectOAuth
                    }}
                />
            </div>
            <Button onClick={connectOAuth} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Linear"}
            </Button>
            {selectedOption && (
                <div className="space-y-4 border-t border-border pt-3">
                    <div className="space-y-1">
                        <Label className="text-sm font-medium">Event Types</Label>
                        <p className="text-xs text-muted-foreground">Select the Linear events that should trigger this agent.</p>
                    </div>
                    <div className="space-y-2">
                        {LINEAR_EVENT_TYPES.map(eventType => (
                            <label key={eventType.value} className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/50 cursor-pointer">
                                <Checkbox
                                    checked={currentConfig?.eventTypes?.includes(eventType.value) || false}
                                    onCheckedChange={checked => {
                                        const nextEventTypes = checked
                                            ? [...(currentConfig?.eventTypes || []), eventType.value]
                                            : (currentConfig?.eventTypes || []).filter(type => type !== eventType.value)
                                        setConfig(new LinearInputConfig(selectedOption!.value, currentConfig?.projectId, currentConfig?.projectName, nextEventTypes))
                                    }}
                                    className="mt-0.5"
                                />
                                <div className="space-y-0.5">
                                    <div className="text-sm font-medium">{eventType.label}</div>
                                    <div className="text-xs text-muted-foreground">{eventType.description}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

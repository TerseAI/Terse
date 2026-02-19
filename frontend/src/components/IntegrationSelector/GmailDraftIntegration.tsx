import { AlertTriangleIcon, Plus } from "lucide-react"

import { useGmailIntegrations } from "@/hooks/api/useGmailIntegrations"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { GmailIntegration as GmailIntegrationType, IntegrationType } from "@/shared/Integrations"

import { IconForConfigType } from "../../pages/Agents/components/Integration"
import { ConfigType, GmailDraftOutputConfig } from "../../shared/Configs"
import DropdownSelect from "../ui/DropdownSelect"
import { StatusOption } from "../ui/DropdownSelect"
import { Button } from "../ui/button"

import { InputConfigSelectorProps } from "./types"

export function GmailDraftIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useGmailIntegrations()
    const currentConfig = input.config as GmailDraftOutputConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.GMAIL_DRAFT_OUTPUT)

    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.GMAIL>(IntegrationType.GMAIL, {})

    function onSelectIntegration(value: string) {
        const integration = integrations.find((integration: GmailIntegrationType) => integration.id === value)
        if (integration) {
            setSelectedIntegrationId(integration.id)
            const config = new GmailDraftOutputConfig(integration.id)
            setConfig(config)
        }
    }

    function onClickConnect() {
        connectOAuth()
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
                    Connect Gmail
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No Gmail accounts connected</div>
                <Button onClick={onClickConnect} disabled={isOAuthConnecting}>
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? "Connecting..." : `Connect Gmail`}
                </Button>
            </div>
        )
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: GmailIntegrationType) => ({
        label: integration.email,
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === currentConfig?.integrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length === 1) {
        const defaultIntegration = connectionSelections[0]
        setSelectedIntegrationId(defaultIntegration.value)
        setConfig(new GmailDraftOutputConfig(defaultIntegration.value))
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    // Card variant: compact view
    if (variant === "card") {
        const hasConfig = !!currentConfig && !!currentConfig.integrationId
        const isComplete = hasConfig
        if (!isComplete) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Configure
                </div>
            )
        }
        return <div className="text-sm">{selectedOption ? selectedOption.label : "No connection selected"}</div>
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.GMAIL_DRAFT_OUTPUT} />
                </div>
                <div className="flex-1 min-w-0">
                    <DropdownSelect
                        statusOptions={connectionSelections}
                        selectedOption={selectedOption}
                        setSelected={onSelectIntegration}
                        placeholder="No connection selected"
                        additionalAction={{
                            label: "Connect Another Gmail",
                            onClick: onClickConnect
                        }}
                    />
                </div>
            </div>

            <div className="text-xs text-muted-foreground">Terse will create draft emails in this Gmail account</div>

            <Button onClick={onClickConnect} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Gmail"}
            </Button>
        </div>
    )
}

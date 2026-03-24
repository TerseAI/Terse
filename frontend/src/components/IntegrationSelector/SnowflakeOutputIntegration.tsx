import { AlertTriangleIcon, ArrowUpRight } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useSnowflakeIntegrations } from "@/hooks/api/useSnowflakeIntegrations"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { FrontendRoutes } from "@/shared/FrontendRoutes"
import { ConfigType, SnowflakeOutputConfig } from "@/shared/Configs"
import { SnowflakeIntegration as SnowflakeIntegrationType } from "@/shared/Integrations"

import { IconForConfigType } from "../../pages/Agents/components/Integration"
import DropdownSelect from "../ui/DropdownSelect"
import { Button } from "../ui/button"

import { InputConfigSelectorProps } from "./types"

function buildSnowflakeConfig(integration: SnowflakeIntegrationType): SnowflakeOutputConfig {
    return new SnowflakeOutputConfig(integration.id, integration.warehouse, integration.databaseName ?? undefined, integration.schemaName ?? undefined)
}

function formatSnowflakeLabel(integration: SnowflakeIntegrationType): string {
    return integration.warehouse ? `${integration.accountIdentifier} - ${integration.warehouse}` : integration.accountIdentifier
}

function formatSnowflakeSummary(integration: SnowflakeIntegrationType): string {
    const parts = [integration.accountIdentifier]
    if (integration.warehouse) {
        parts.push(`WH: ${integration.warehouse}`)
    }
    if (integration.databaseName) {
        parts.push(`DB: ${integration.databaseName}`)
    }
    if (integration.schemaName) {
        parts.push(`Schema: ${integration.schemaName}`)
    }
    return parts.join(" · ")
}

export function SnowflakeOutputIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const navigate = useNavigate()
    const { integrations, isLoading } = useSnowflakeIntegrations()
    const currentConfig = input.config as SnowflakeOutputConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.SNOWFLAKE_OUTPUT)

    const openIntegrations = () => {
        navigate(FrontendRoutes.INTEGRATIONS)
    }

    function onSelectIntegration(value: string) {
        const integration = integrations.find((item: SnowflakeIntegrationType) => item.id === value)
        if (integration) {
            setSelectedIntegrationId(integration.id)
            setConfig(buildSnowflakeConfig(integration))
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
                    Connect Snowflake
                </div>
            )
        }

        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No Snowflake accounts connected</div>
                <Button onClick={openIntegrations} variant="outline">
                    <ArrowUpRight className="w-4 h-4" />
                    Open Integrations
                </Button>
            </div>
        )
    }

    const connectionSelections = integrations.map((integration: SnowflakeIntegrationType) => ({
        label: formatSnowflakeLabel(integration),
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === currentConfig?.integrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length === 1) {
        const defaultIntegration = integrations[0]
        setSelectedIntegrationId(defaultIntegration.id)
        setConfig(buildSnowflakeConfig(defaultIntegration))
        selectedOption = connectionSelections[0]
    } else if (!selectedOption) {
        selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId) ?? connectionSelections[0]
    }

    const selectedIntegration = integrations.find(integration => integration.id === (currentConfig?.integrationId || selectedIntegrationId))

    if (variant === "card") {
        if (!currentConfig?.integrationId) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-warning" />
                    Configure
                </div>
            )
        }

        return <div className="text-sm truncate">{selectedIntegration ? formatSnowflakeSummary(selectedIntegration) : selectedOption?.label || "No connection selected"}</div>
    }

    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.SNOWFLAKE_OUTPUT} />
                </div>
                <div className="flex-1 min-w-0">
                    <DropdownSelect
                        statusOptions={connectionSelections}
                        selectedOption={selectedOption}
                        setSelected={onSelectIntegration}
                        placeholder="No connection selected"
                        additionalAction={{
                            label: "Manage Snowflake Integrations",
                            onClick: openIntegrations
                        }}
                    />
                </div>
            </div>

            <div className="text-xs text-muted-foreground">Queries will use the selected Snowflake connection and its saved warehouse, database, and schema defaults.</div>

            {selectedIntegration && <div className="text-xs text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2">{formatSnowflakeSummary(selectedIntegration)}</div>}

            <Button onClick={openIntegrations} variant="outline">
                <ArrowUpRight className="w-4 h-4" />
                Manage Snowflake Integrations
            </Button>
        </div>
    )
}
